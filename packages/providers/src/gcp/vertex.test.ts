import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { sampleCharacterPhoto, sampleStoryRequest } from '../testing';
import { watermarkPreview } from '../images';
import {
  VertexClient,
  VertexImageProvider,
  VertexTextProvider,
  blockDetail,
  vertexCostUsdMicros,
} from './vertex';

type Handler = (body: { contents: { parts: Record<string, unknown>[] }[] }) => {
  status?: number;
  json: unknown;
};

/** Cliente con un fetch simulado: nunca llama a Vertex de verdad. */
function clientWith(handler: Handler, calls: unknown[] = []) {
  const fakeFetch = ((_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string) as Parameters<Handler>[0];
    calls.push(body);
    const { status = 200, json } = handler(body);
    return Promise.resolve(new Response(JSON.stringify(json), { status }));
  }) as typeof fetch;
  return new VertexClient({
    projectId: 'test-project',
    models: () => ({ text: 'gemini-3.5-flash', image: 'gemini-3.1-flash-image' }),
    getAccessToken: () => Promise.resolve('test-token'),
    fetch: fakeFetch,
  });
}

const jsonReply = (
  value: unknown,
  tokens = { promptTokenCount: 1000, candidatesTokenCount: 500 },
) => ({
  json: {
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }],
    usageMetadata: tokens,
  },
});

describe('Vertex AI', () => {
  it('un corte por tiempo se reintenta una vez solo si queda tope', async () => {
    let calls = 0;
    const slowThenOk = ((_url: string | URL | Request, init?: RequestInit) => {
      calls += 1;
      if (calls === 1) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(init.signal?.reason as Error);
          });
        });
      }
      return Promise.resolve(new Response(JSON.stringify(jsonReply({ ok: true }).json)));
    }) as typeof fetch;
    const client = new VertexClient({
      projectId: 'test-project',
      models: () => ({ text: 'gemini-3.5-flash', image: 'gemini-3.1-flash-image' }),
      getAccessToken: () => Promise.resolve('test-token'),
      fetch: slowThenOk,
    });
    // Sin tope total: el corte no se reintenta.
    await expect(
      client.generate('gemini-3.5-flash', [{ text: 'hola' }], {}, { timeoutMs: 20 }),
    ).rejects.toMatchObject({ name: 'TimeoutError' });
    calls = 0;
    // Con tope y lugar para otro intento: se reintenta una vez y sale bien.
    await expect(
      client.generate(
        'gemini-3.5-flash',
        [{ text: 'hola' }],
        {},
        { timeoutMs: 20, budgetMs: 60_000 },
      ),
    ).resolves.toMatchObject({ usage: { provider: 'vertex' } });
    expect(calls).toBe(2);
  });

  it('estricto por defecto; describir una foto bloquea solo lo alto y no asume que es un chico', async () => {
    const calls: {
      safetySettings?: { threshold: string }[];
      contents: { parts: { text?: string }[] }[];
    }[] = [];
    const client = clientWith(() => jsonReply({ ok: true }), calls);
    await client.generate('gemini-3.5-flash', [{ text: 'hola' }], {});
    expect(
      calls[0]?.safetySettings?.every((item) => item.threshold === 'BLOCK_LOW_AND_ABOVE'),
    ).toBe(true);

    const blockedClient = clientWith(
      () => ({ json: { promptFeedback: { blockReason: 'SAFETY' }, candidates: [] } }),
      calls,
    );
    await expect(
      new VertexTextProvider(blockedClient).describeCharacter({
        bytes: new Uint8Array([1]),
        mimeType: 'image/jpeg',
      }),
    ).rejects.toThrow(/bloqueado por seguridad \(blockReason=SAFETY\)/);
    const describe = calls[1];
    expect(describe?.safetySettings?.every((item) => item.threshold === 'BLOCK_ONLY_HIGH')).toBe(
      true,
    );
    const prompt = describe?.contents[0]?.parts.map((part) => part.text ?? '').join('') ?? '';
    expect(prompt).toContain('main person in this photo');
    expect(prompt).toContain('Do not guess identity, ethnicity, name or location');
  });

  it('calcula el costo con la tabla de precios y usa el peor caso para modelos desconocidos', () => {
    // 1.000 tokens de entrada a 0,5 + 500 de salida a 3 USD por millón = 2.000 micro dólares.
    expect(
      vertexCostUsdMicros('gemini-3.5-flash', {
        promptTokenCount: 1000,
        candidatesTokenCount: 500,
      }),
    ).toBe(2000);
    expect(vertexCostUsdMicros('modelo-nuevo', { candidatesTokenCount: 1000 })).toBe(120_000);
    // El catálogo del admin manda; si no tiene precio, la tabla de lista o el peor caso.
    const catalog = (model: string) =>
      model === 'modelo-nuevo' ? { inputPerMTok: 1, outputPerMTok: 10 } : null;
    expect(vertexCostUsdMicros('modelo-nuevo', { candidatesTokenCount: 1000 }, catalog)).toBe(
      10_000,
    );
    expect(vertexCostUsdMicros('otro', { candidatesTokenCount: 1000 }, catalog)).toBe(120_000);
  });

  it('genera el cuento con la cantidad de páginas pedida y su costo', async () => {
    const pages = Array.from({ length: sampleStoryRequest.pageCount }, (_, index) => ({
      text: `Página ${String(index + 1)}`,
      illustrationPrompt: `Scene ${String(index + 1)}`,
    }));
    const provider = new VertexTextProvider(
      clientWith(() => jsonReply({ title: 'Martina', pages })),
    );
    const story = await provider.generateStory(sampleStoryRequest);
    expect(story.pages.map((page) => page.index)).toEqual([0, 1, 2, 3]);
    expect(story.usage).toEqual({
      provider: 'vertex',
      model: 'gemini-3.5-flash',
      costUsdMicros: 2000,
    });
  });

  it('ortografía aparte a temperatura 0; si cambia las páginas, conserva el texto', async () => {
    const story = {
      title: 'Martina',
      pages: [0, 1, 2, 3].map((index) => ({
        index,
        text: `Pagina ${String(index + 1)}`,
        illustrationPrompt: `Scene ${String(index + 1)}`,
      })),
      usage: { provider: 'vertex', model: 'm', costUsdMicros: 0 },
    };
    const calls: { generationConfig: { temperature: number } }[] = [];
    const fixed = await new VertexTextProvider(
      clientWith(
        () =>
          jsonReply({
            title: 'Martina',
            pages: story.pages.map((page) => ({ text: page.text.replace('Pagina', 'Página') })),
          }),
        calls,
      ),
    ).proofreadStory(story, sampleStoryRequest);
    expect(calls[0]?.generationConfig.temperature).toBe(0);
    expect(fixed.pages[0]).toEqual({ index: 0, text: 'Página 1', illustrationPrompt: 'Scene 1' });
    const short = await new VertexTextProvider(
      clientWith(() => jsonReply({ title: 'Martina', pages: [{ text: 'x' }] })),
    ).proofreadStory(story, sampleStoryRequest);
    expect(short.pages).toEqual(story.pages);
  });

  it('la revisión editorial recibe los problemas concretos para reescribir', async () => {
    const calls: { contents: { parts: { text?: string }[] }[] }[] = [];
    const story = {
      title: 'Martina',
      pages: [{ index: 0, text: 'a', illustrationPrompt: 'b' }],
      usage: { provider: 'vertex', model: 'm', costUsdMicros: 0 },
    };
    await new VertexTextProvider(
      clientWith(
        () =>
          jsonReply({
            approved: true,
            issues: [],
            pages: [{ text: 'a', illustrationPrompt: 'b' }],
          }),
        calls,
      ),
    ).reviewStory(story, sampleStoryRequest, { issues: ['Moraleja explícita («la lección»)'] });
    expect(calls[0]?.contents[0]?.parts[0]?.text).toContain('- Moraleja explícita («la lección»)');
  });

  it('escenas desde el texto final: una por página o reintentable', async () => {
    const pages = [0, 1].map((index) => ({
      index,
      text: `t${String(index)}`,
      illustrationPrompt: 'p',
    }));
    const request = { childName: 'Martina', pages, scenes: null, recurring: ['Grandma Rosa'] };
    const calls: { contents: { parts: { text?: string }[] }[] }[] = [];
    const ok = await new VertexTextProvider(
      clientWith(() => jsonReply({ prompts: [' one ', 'two'] }), calls),
    ).describeScenes(request);
    expect(ok.prompts).toEqual(['one', 'two']);
    expect(calls[0]?.contents[0]?.parts[0]?.text).toContain('who is not');
    expect(calls[0]?.contents[0]?.parts[0]?.text).toContain('Grandma Rosa');
    await expect(
      new VertexTextProvider(clientWith(() => jsonReply({ prompts: ['one'] }))).describeScenes(
        request,
      ),
    ).rejects.toMatchObject({ retryable: true });
  });

  it('rechaza un cuento con otra cantidad de páginas (reintentable)', async () => {
    const provider = new VertexTextProvider(
      clientWith(() => jsonReply({ title: 'x', pages: [{ text: 'a', illustrationPrompt: 'b' }] })),
    );
    await expect(provider.generateStory(sampleStoryRequest)).rejects.toMatchObject({
      retryable: true,
    });
  });

  it('la moderación rechaza lo que bloquean los filtros de seguridad', async () => {
    const provider = new VertexTextProvider(
      clientWith(() => ({ json: { promptFeedback: { blockReason: 'SAFETY' } } })),
    );
    expect(await provider.moderateText('algo')).toMatchObject({
      allowed: false,
      categories: ['blocked_by_safety'],
    });
  });

  it('manda la foto y las ilustraciones previas como referencia del personaje', async () => {
    const calls: { contents: { parts: Record<string, unknown>[] }[] }[] = [];
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#eadcf2' },
    })
      .png()
      .toBuffer();
    const provider = new VertexImageProvider(
      clientWith(
        () => ({
          json: {
            candidates: [
              {
                finishReason: 'STOP',
                content: {
                  parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }],
                },
              },
            ],
            usageMetadata: { promptTokenCount: 600, candidatesTokenCount: 1120 },
          },
        }),
        calls,
      ),
    );
    const image = await provider.generateIllustration({
      prompt: 'Martina rides a cardboard rocket',
      stylePrompt: 'soft watercolor',
      character: { description: 'curly brown hair', photo: sampleCharacterPhoto() },
      references: [{ bytes: new Uint8Array(png), mimeType: 'image/png' }],
      aspectRatio: '3:4',
      seed: 7,
    });
    expect(image.mimeType).toBe('image/png');
    expect(image.usage.costUsdMicros).toBe(Math.ceil(600 * 0.5 + 1120 * 60));
    const parts = calls[0]?.contents[0]?.parts ?? [];
    expect(parts.filter((part) => 'inlineData' in part)).toHaveLength(2);
    expect(String(parts.at(-1)?.text)).toContain('reference illustrations of the main character');
  });

  it('reintenta ante un 429 y después responde', async () => {
    let attempts = 0;
    const provider = new VertexTextProvider(
      clientWith(() => {
        attempts += 1;
        return attempts === 1
          ? { status: 429, json: { error: 'busy' } }
          : jsonReply({ allowed: true, categories: [] });
      }),
    );
    expect((await provider.moderateText('Martina juega')).allowed).toBe(true);
    expect(attempts).toBe(2);
  }, 10_000);
});

describe('marca de agua', () => {
  it('reduce a 1024 px como máximo y cambia los píxeles', async () => {
    const clean = await sharp({
      create: { width: 1536, height: 2048, channels: 3, background: '#faf0e5' },
    })
      .png()
      .toBuffer();
    const marked = await watermarkPreview(new Uint8Array(clean));
    const meta = await sharp(marked).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width, meta.height)).toBe(1024);
    const stats = await sharp(marked).stats();
    // Un fondo liso sin marca tendría desvío ~0.
    expect(stats.channels[0]?.stdev ?? 0).toBeGreaterThan(1);
  });
});

describe('blockDetail', () => {
  it('resume por qué bloqueó Vertex, solo con códigos (sin contenido)', () => {
    expect(
      blockDetail({
        promptFeedback: { blockReason: 'PROHIBITED_CONTENT' },
        candidates: [
          {
            finishReason: 'SAFETY',
            safetyRatings: [
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', probability: 'LOW', blocked: true },
              { category: 'HARM_CATEGORY_HATE_SPEECH', probability: 'NEGLIGIBLE' },
            ],
          },
        ],
      }),
    ).toBe(
      ' (blockReason=PROHIBITED_CONTENT; finishReason=SAFETY; ratings: SEXUALLY_EXPLICIT=LOW(blocked))',
    );
    expect(blockDetail({})).toBe('');
  });
});
