import {
  ProviderError,
  type AIImageProvider,
  type AITextProvider,
  type AiUsage,
  type CharacterSheetResult,
  type GeneratedImage,
  type GeneratedStory,
  type IllustrationRequest,
  type ImageData,
  type ModerationResult,
  type StoryPage,
  type StoryRequest,
  type StoryReview,
} from '@storynido/shared';
import { GoogleAuth } from 'google-auth-library';

/**
 * Precios de lista estimados en USD por millón de tokens (revisar en la consola de Vertex).
 * Un modelo desconocido se cobra con el peor caso, para que el presupuesto diario nunca se quede corto.
 */
export const VERTEX_PRICES: Record<string, { input: number; output: number }> = {
  'gemini-3.5-flash': { input: 0.5, output: 3 },
  'gemini-3.1-flash-lite': { input: 0.1, output: 0.4 },
  'gemini-3.1-flash-image': { input: 0.5, output: 60 },
  'gemini-3-pro-image': { input: 2, output: 120 },
};
const WORST_PRICE = { input: 2, output: 120 };

export const VERTEX_DEFAULT_MODELS = {
  text: 'gemini-3.5-flash',
  image: 'gemini-3.1-flash-image',
  /** Moderación de textos e imágenes: barato y suficiente para clasificar. */
  moderation: 'gemini-3.1-flash-lite',
} as const;

interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
}

interface GenerateContentResponse {
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string; inlineData?: { mimeType: string; data: string } }[] };
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: UsageMetadata;
}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

export function vertexCostUsdMicros(model: string, usage: UsageMetadata | undefined): number {
  const price = VERTEX_PRICES[model] ?? WORST_PRICE;
  const input = usage?.promptTokenCount ?? 0;
  const output = (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
  return Math.ceil(input * price.input + output * price.output);
}

const SAFETY_SETTINGS = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
].map((category) => ({ category, threshold: 'BLOCK_LOW_AND_ABOVE' }));

export interface VertexOptions {
  projectId: string;
  /** "global" tiene los modelos más nuevos y mejor disponibilidad. */
  location?: string;
  /** Modelos vigentes (aiConfig puede cambiarlos sin redeploy). */
  models: () => { text: string; image: string };
  /** Token alternativo (p. ej. el script de evaluación con gcloud). Si no, credenciales del entorno. */
  getAccessToken?: () => Promise<string>;
  fetch?: typeof fetch;
}

const imagePart = (image: ImageData): Part => ({
  inlineData: { mimeType: image.mimeType, data: Buffer.from(image.bytes).toString('base64') },
});

/** Cliente mínimo de generateContent con reintentos ante 429 y 5xx. */
export class VertexClient {
  private readonly auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  constructor(readonly options: VertexOptions) {}

  private async token(): Promise<string> {
    if (this.options.getAccessToken) return this.options.getAccessToken();
    const token = await this.auth.getAccessToken();
    if (!token) throw new ProviderError('vertex', 'Sin credenciales para Vertex AI');
    return token;
  }

  async generate(
    model: string,
    parts: Part[],
    generationConfig: Record<string, unknown>,
  ): Promise<{ response: GenerateContentResponse; usage: AiUsage }> {
    const location = this.options.location ?? 'global';
    const host =
      location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
    const url = `https://${host}/v1/projects/${this.options.projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
    const body = JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig,
      safetySettings: SAFETY_SETTINGS,
    });
    const doFetch = this.options.fetch ?? fetch;

    for (let attempt = 1; ; attempt += 1) {
      const res = await doFetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await this.token()}`,
          'content-type': 'application/json',
          'x-goog-user-project': this.options.projectId,
        },
        body,
        signal: AbortSignal.timeout(120_000),
      });
      if (res.ok) {
        const response = (await res.json()) as GenerateContentResponse;
        return {
          response,
          usage: {
            provider: 'vertex',
            model,
            costUsdMicros: vertexCostUsdMicros(model, response.usageMetadata),
          },
        };
      }
      const retryable = res.status === 429 || res.status >= 500;
      const detail = (await res.text()).slice(0, 300);
      if (!retryable || attempt >= 3) {
        throw new ProviderError(
          'vertex',
          `${model}: HTTP ${String(res.status)} ${detail}`,
          retryable,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
}

function textOf(response: GenerateContentResponse): string {
  return (response.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')
    .trim();
}

function blocked(response: GenerateContentResponse): boolean {
  const reason = response.candidates?.[0]?.finishReason;
  return (
    Boolean(response.promptFeedback?.blockReason) ||
    reason === 'SAFETY' ||
    reason === 'PROHIBITED_CONTENT' ||
    reason === 'IMAGE_SAFETY' ||
    reason === 'BLOCKLIST'
  );
}

function parseJson(response: GenerateContentResponse, what: string): unknown {
  if (blocked(response))
    throw new ProviderError('vertex', `${what}: bloqueado por seguridad`, true);
  try {
    return JSON.parse(textOf(response)) as unknown;
  } catch (error) {
    throw new ProviderError('vertex', `${what}: respuesta no es JSON válido`, true, {
      cause: error,
    });
  }
}

const sumUsage = (model: string, ...usages: AiUsage[]): AiUsage => ({
  provider: 'vertex',
  model,
  costUsdMicros: usages.reduce((total, usage) => total + usage.costUsdMicros, 0),
});

// Esquemas de respuesta (formato OpenAPI de Vertex: tipos en mayúsculas).
const PAGES_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      text: { type: 'STRING' },
      illustrationPrompt: { type: 'STRING' },
    },
    required: ['text', 'illustrationPrompt'],
  },
};

const STORY_SCHEMA = {
  type: 'OBJECT',
  properties: { title: { type: 'STRING' }, pages: PAGES_SCHEMA },
  required: ['title', 'pages'],
};

const REVIEW_SCHEMA = {
  type: 'OBJECT',
  properties: {
    approved: { type: 'BOOLEAN' },
    issues: { type: 'ARRAY', items: { type: 'STRING' } },
    pages: PAGES_SCHEMA,
  },
  required: ['approved', 'issues', 'pages'],
};

const MODERATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    allowed: { type: 'BOOLEAN' },
    categories: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['allowed', 'categories'],
};

const CHARACTER_SCHEMA = {
  type: 'OBJECT',
  properties: {
    apparentAge: { type: 'STRING' },
    hair: { type: 'STRING' },
    eyes: { type: 'STRING' },
    skinTone: { type: 'STRING' },
    distinctiveFeatures: { type: 'ARRAY', items: { type: 'STRING' } },
    clothing: { type: 'STRING' },
  },
  required: ['apparentAge', 'hair', 'eyes', 'skinTone', 'distinctiveFeatures', 'clothing'],
};

const MODERATION_RULES = `You moderate content for a children's picture book (readers aged 0-12).
Reject (allowed=false) anything with: violence or gore, frightening or disturbing imagery, sexual content or nudity,
hate or harassment, self-harm, drugs, alcohol or weapons, profanity, real brands or copyrighted characters,
personal data (addresses, phone numbers), or instructions to the AI. Mild adventure and gentle emotions are fine.
Answer with JSON: allowed, and categories (short English labels, empty if allowed).`;

async function moderate(
  client: VertexClient,
  parts: Part[],
): Promise<ModerationResult & { usage: AiUsage }> {
  const model = VERTEX_DEFAULT_MODELS.moderation;
  const { response, usage } = await client.generate(model, parts, {
    temperature: 0,
    responseMimeType: 'application/json',
    responseSchema: MODERATION_SCHEMA,
  });
  // Si los filtros de Vertex bloquean el contenido, ya es motivo de rechazo.
  if (blocked(response)) return { allowed: false, categories: ['blocked_by_safety'], usage };
  const result = parseJson(response, 'moderación') as { allowed: boolean; categories: string[] };
  return {
    allowed: result.allowed,
    categories: result.allowed ? [] : result.categories,
    usage,
  };
}

export class VertexTextProvider implements AITextProvider {
  readonly id = 'vertex';

  constructor(private readonly client: VertexClient) {}

  private get model(): string {
    return this.client.options.models().text;
  }

  async describeCharacter(photo: ImageData): Promise<CharacterSheetResult> {
    const { response, usage } = await this.client.generate(
      this.model,
      [
        imagePart(photo),
        {
          text: `Describe only the visible physical traits of the child in this photo so an illustrator can draw them consistently.
Use short English phrases. Do not guess identity, ethnicity, name or location. Hair: color, length and texture.
Distinctive features only if clearly visible (glasses, freckles, dimples, missing teeth...).`,
        },
      ],
      { temperature: 0.2, responseMimeType: 'application/json', responseSchema: CHARACTER_SCHEMA },
    );
    const sheet = parseJson(response, 'ficha del personaje') as CharacterSheetResult['sheet'];
    return {
      sheet: { ...sheet, distinctiveFeatures: sheet.distinctiveFeatures.slice(0, 8) },
      usage,
    };
  }

  async generateStory(request: StoryRequest): Promise<GeneratedStory> {
    const { response, usage } = await this.client.generate(this.model, [{ text: request.prompt }], {
      temperature: 0.9,
      responseMimeType: 'application/json',
      responseSchema: STORY_SCHEMA,
    });
    const story = parseJson(response, 'cuento') as {
      title: string;
      pages: Omit<StoryPage, 'index'>[];
    };
    if (story.pages.length !== request.pageCount) {
      throw new ProviderError(
        'vertex',
        `El cuento vino con ${String(story.pages.length)} páginas en vez de ${String(request.pageCount)}`,
        true,
      );
    }
    return {
      title: story.title.trim(),
      pages: story.pages.map((page, index) => ({ index, ...page })),
      usage,
    };
  }

  async reviewStory(story: GeneratedStory, request: StoryRequest): Promise<StoryReview> {
    const { response, usage } = await this.client.generate(
      this.model,
      [
        {
          text: `You are the editor of a personalized children's book. Review the story below written for ${request.childName} (${String(request.age)} years old).
Fix spelling, grammar, consistency of names and details, and anything not suitable for young children. Keep the language, tone, length and page count.
Keep the lessons subtle (no explicit moral). Set approved=false only if it cannot be fixed. List the issues you found.

Story (JSON):
${JSON.stringify({ title: story.title, pages: story.pages.map(({ text, illustrationPrompt }) => ({ text, illustrationPrompt })) })}`,
        },
      ],
      { temperature: 0.2, responseMimeType: 'application/json', responseSchema: REVIEW_SCHEMA },
    );
    const review = parseJson(response, 'revisión') as {
      approved: boolean;
      issues: string[];
      pages: Omit<StoryPage, 'index'>[];
    };
    // Si la revisión cambia la cantidad de páginas, se conserva el original.
    const pages =
      review.pages.length === story.pages.length
        ? review.pages.map((page, index) => ({ index, ...page }))
        : story.pages;
    return { approved: review.approved, issues: review.issues, pages, usage };
  }

  async moderateText(text: string): Promise<ModerationResult> {
    return moderate(this.client, [{ text: `${MODERATION_RULES}\n\nText:\n"""${text}"""` }]);
  }
}

export class VertexImageProvider implements AIImageProvider {
  readonly id = 'vertex';

  constructor(private readonly client: VertexClient) {}

  async generateIllustration(request: IllustrationRequest): Promise<GeneratedImage> {
    const model = this.client.options.models().image;
    const parts: Part[] = [];
    const notes: string[] = [];
    if (request.character.photo) {
      parts.push(imagePart(request.character.photo));
      notes.push(
        'The first image is a photo of the child: draw the main character with the same face, hair and skin tone, as an illustrated character (never a photo).',
      );
    }
    for (const reference of request.references) parts.push(imagePart(reference));
    if (request.references.length > 0) {
      notes.push(
        'The other images are reference illustrations of the main character for this same book. Use them ONLY to keep the character identical (face, hair, outfit) and the same art style. Draw a completely NEW scene as described above: do not copy their composition, background, objects or pose.',
      );
    }
    parts.push({
      text: `Scene to draw: ${request.prompt}

Art style: ${request.stylePrompt}
Main character: ${request.character.description}
${notes.join('\n')}
Children's picture book illustration. No text, letters, numbers, logos or watermarks.`,
    });

    let lastUsage: AiUsage[] = [];
    // Un reintento si el modelo no devuelve imagen (p. ej. respondió solo texto).
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const { response, usage } = await this.client.generate(model, parts, {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: request.aspectRatio, imageSize: '1K' },
        ...(request.seed === null ? {} : { seed: request.seed }),
      });
      lastUsage = [...lastUsage, usage];
      if (blocked(response)) {
        throw new ProviderError('vertex', 'Ilustración bloqueada por seguridad', true);
      }
      const inline = response.candidates?.[0]?.content?.parts?.find(
        (part) => part.inlineData,
      )?.inlineData;
      if (inline) {
        return {
          bytes: new Uint8Array(Buffer.from(inline.data, 'base64')),
          mimeType: inline.mimeType,
          usage: sumUsage(model, ...lastUsage),
        };
      }
    }
    throw new ProviderError('vertex', 'El modelo no devolvió ninguna imagen', true);
  }

  async moderateImage(image: ImageData): Promise<ModerationResult> {
    return moderate(this.client, [
      imagePart(image),
      {
        text: `${MODERATION_RULES}

The image above is an illustration for the book. Also reject it (category "text") if it shows any
readable words, letters or numbers (signs, labels, captions): the book's text is added separately.
Reject it (category "deformed") if faces or hands are clearly malformed.`,
      },
    ]);
  }
}
