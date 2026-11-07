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

  it('plan con biblia visual: limpia nombres sueltos, varía encuadres y es compatible sin biblia', async () => {
    const scene = (shot: string, extra: Record<string, unknown> = {}) => ({
      sceneGoal: 'meta',
      emotionalBeat: 'alegría',
      mustBeVisible: [],
      notVisible: [],
      continuityFacts: [],
      wordBudget: 20,
      shot,
      ...extra,
    });
    const reply = {
      theme: 't',
      arc: 'a',
      props: [
        { name: 'the kite', look: 'arc-shaped kite; NO sail' },
        { name: '', look: 'x' },
        ...Array.from({ length: 5 }, (_, index) => ({ name: `p${String(index)}`, look: 'l' })),
      ],
      places: [{ name: 'the beach', look: 'sandy beach' }],
      outfits: [{ context: 'in the water', look: 'wetsuit' }],
      scenes: [
        scene('wide', {
          props: ['the kite', 'a ghost prop'],
          place: 'the moon',
          outfit: 'in the water',
        }),
        scene('wide'),
        scene('wide'),
        scene('medium'),
      ],
    };
    const calls: { contents: { parts: { text?: string }[] }[] }[] = [];
    const plan = await new VertexTextProvider(clientWith(() => jsonReply(reply), calls)).planStory(
      sampleStoryRequest,
    );
    expect(plan.props).toHaveLength(4);
    expect(plan.scenes[0]).toMatchObject({
      props: ['the kite'],
      place: null,
      outfit: 'in the water',
    });
    expect(plan.scenes.map((item) => item.shot)).not.toEqual(['wide', 'wide', 'wide', 'medium']);
    const prompt = calls[0]?.contents[0]?.parts[0]?.text ?? '';
    expect(prompt).toContain('NO sail and NO mast');
    expect(prompt).toContain('who is not in that scene');

    const old = await new VertexTextProvider(
      clientWith(() =>
        jsonReply({ theme: 't', arc: 'a', scenes: [0, 1, 2, 3].map(() => scene('medium')) }),
      ),
    ).planStory(sampleStoryRequest);
    expect(old.props).toEqual([]);
    expect(old.scenes[0]?.place).toBeNull();
  });

  it('la revisión de página recibe la continuidad y la biblia visual de la escena', async () => {
    const calls: { contents: { parts: { text?: string }[] }[] }[] = [];
    const provider = new VertexTextProvider(
      clientWith(
        () =>
          jsonReply({
            status: 'pass',
            criticalIssues: [],
            nonCriticalIssues: [],
            continuityChecks: [],
            imageTextMatches: true,
            textInImage: false,
            repairTarget: 'none',
          }),
        calls,
      ),
    );
    const image = { bytes: new Uint8Array([1]), mimeType: 'image/webp' };
    await provider.reviewPage({
      pageIndex: 2,
      text: 'texto',
      image,
      reference: image,
      character: 'Martina',
      mustKeep: [],
      scene: {
        pageIndex: 1,
        sceneGoal: 'meta',
        emotionalBeat: 'alegría',
        mustBeVisible: [],
        notVisible: [],
        continuityFacts: ['the red lantern'],
        wordBudget: 20,
        personalDetail: null,
      },
      visualBible: 'Place: the beach, sandy beach.',
    });
    const text = (calls[0]?.contents[0]?.parts ?? []).map((part) => part.text ?? '').join(' ');
    expect(text).toContain('Continuity (must match');
    expect(text).toContain('the red lantern');
    expect(text).toContain('Fixed looks for this scene: Place: the beach');
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
