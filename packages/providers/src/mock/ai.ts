import type {
  AIImageProvider,
  AITextProvider,
  ActivityRequest,
  AiUsage,
  CharacterSheetResult,
  GeneratedActivities,
  GeneratedImage,
  GeneratedStory,
  IllustrationRequest,
  ImageData,
  Locale,
  ModerationResult,
  PageReview,
  PageReviewRequest,
  StoryPlan,
  StoryRequest,
  StoryReview,
} from '@storynido/shared';

import { sha256Hex } from '../crypto';

/** Texto que fuerza a la moderación simulada a rechazar (para probar el control de calidad). */
export const MOCK_UNSAFE_MARKER = '[[unsafe]]';

const PHRASES: Record<Locale, (name: string, like: string, page: number) => string> = {
  es: (name, like, page) => `Página ${page}: ${name} vive una aventura llena de ${like}.`,
  en: (name, like, page) => `Page ${page}: ${name} goes on an adventure full of ${like}.`,
  pt: (name, like, page) => `Página ${page}: ${name} vive uma aventura cheia de ${like}.`,
};

const DEFAULT_LIKE: Record<Locale, string> = { es: 'magia', en: 'magic', pt: 'magia' };

/** Relleno para llegar a la densidad pedida (el texto simulado respeta el rango de palabras). */
const FILLER: Record<Locale, string> = {
  es: 'Juntos descubren algo nuevo y sonríen.',
  en: 'Together they discover something new and smile.',
  pt: 'Juntos descobrem algo novo e sorriem.',
};

function fitWords(text: string, filler: string, range?: { min: number; max: number }): string {
  if (!range) return text;
  let words = text.split(/\s+/);
  while (words.length < range.min) words = [...words, ...filler.split(/\s+/)];
  return words.slice(0, range.max).join(' ');
}

const usage = (model: string): AiUsage => ({ provider: 'mock', model, costUsdMicros: 0 });

function moderate(text: string): ModerationResult {
  return text.includes(MOCK_UNSAFE_MARKER)
    ? { allowed: false, categories: ['mock_unsafe'], usage: usage('mock-moderation') }
    : { allowed: true, categories: [], usage: usage('mock-moderation') };
}

export class MockAITextProvider implements AITextProvider {
  readonly id = 'mock';

  generateStory(request: StoryRequest): Promise<GeneratedStory> {
    if (!Number.isInteger(request.pageCount) || request.pageCount < 1 || request.pageCount > 40) {
      return Promise.reject(new RangeError('pageCount debe estar entre 1 y 40'));
    }
    const pages = Array.from({ length: request.pageCount }, (_, index) => {
      const like =
        request.likes[index % Math.max(request.likes.length, 1)] ?? DEFAULT_LIKE[request.language];
      const lesson = index === 1 ? request.lessons[0] : undefined;
      // Los nombres obligatorios (apodo) aparecen en la primera página.
      const extra =
        index === 0 && request.mustInclude?.length ? ` ${request.mustInclude.join(' ')}` : '';
      return {
        index,
        text: fitWords(
          PHRASES[request.language](request.childName, like, index + 1) +
            (lesson ? ` (${lesson.name})` : '') +
            extra,
          FILLER[request.language],
          request.wordsPerPage,
        ),
        illustrationPrompt: `${request.childName}, ${request.age} años, escena ${index + 1} de "${request.storyTitle}" con ${like}`,
      };
    });
    return Promise.resolve({
      title: `${request.storyTitle}: ${request.childName}`,
      pages,
      usage: usage('mock-text'),
    });
  }

  reviewStory(story: GeneratedStory): Promise<StoryReview> {
    const issues = story.pages
      .filter((page) => !moderate(page.text).allowed)
      .map((page) => `Página ${page.index + 1}: contenido no apto`);
    return Promise.resolve({
      approved: issues.length === 0,
      issues,
      pages: story.pages.map((page) => ({ ...page, text: page.text.replace(/\s+/g, ' ').trim() })),
      usage: usage('mock-text'),
    });
  }

  moderateText(text: string): Promise<ModerationResult> {
    return Promise.resolve(moderate(text));
  }

  planStory(request: StoryRequest): Promise<StoryPlan> {
    const budget = request.wordsPerPage
      ? Math.round((request.wordsPerPage.min + request.wordsPerPage.max) / 2)
      : 30;
    return Promise.resolve({
      theme: request.storyTitle,
      arc: `${request.childName} quiere algo, encuentra una dificultad, decide y lo logra.`,
      scenes: Array.from({ length: request.pageCount }, (_, pageIndex) => ({
        pageIndex,
        sceneGoal: `Escena ${String(pageIndex + 1)}`,
        emotionalBeat: pageIndex === request.pageCount - 1 ? 'alegría' : 'curiosidad',
        mustBeVisible: [request.childName],
        notVisible: ['text'],
        continuityFacts: [],
        wordBudget: budget,
        personalDetail: pageIndex === 0 ? (request.likes[0] ?? null) : null,
      })),
      usage: usage('mock-text'),
    });
  }

  /** Siempre aprueba: los tests que prueban reparaciones envuelven este método. */
  reviewPage(request: PageReviewRequest): Promise<PageReview> {
    return Promise.resolve({
      pageIndex: request.pageIndex,
      status: 'pass',
      criticalIssues: [],
      nonCriticalIssues: [],
      continuityChecks: [],
      imageTextMatches: true,
      textInImage: false,
      repairTarget: 'none',
      usage: usage('mock-review'),
    });
  }

  generateActivities(request: ActivityRequest): Promise<GeneratedActivities> {
    const templates = request.templates.length
      ? request.templates
      : [{ kind: 'draw_ending', guidance: '' }];
    return Promise.resolve({
      activities: Array.from({ length: request.count }, (_, index) => {
        const template = templates[index % templates.length] ?? { kind: 'draw_ending' };
        return {
          kind: template.kind,
          title: `${request.childName}: actividad ${String(index + 1)}`,
          instructions: `Actividad de ${request.storyTitle}.`,
          items: [request.childName],
          illustrationPrompt: `${request.childName} in a simple outline scene`,
        };
      }),
      usage: usage('mock-text'),
    });
  }

  /** Ficha fija y verosímil: alcanza para probar el flujo sin enviar la foto a ningún lado. */
  describeCharacter(photo: ImageData): Promise<CharacterSheetResult> {
    const shade = parseInt(sha256Hex(photo.bytes).slice(0, 2), 16) % 3;
    return Promise.resolve({
      traits: {
        skinTone: (['medium', 'light', 'brown'] as const)[shade] ?? 'medium',
        hairColor: (['dark-brown', 'light-brown', 'black'] as const)[shade] ?? 'dark-brown',
        hairLength: (['short', 'medium', 'medium'] as const)[shade] ?? 'short',
        hairType: (['curly', 'straight', 'wavy'] as const)[shade] ?? 'curly',
        eyeColor: 'brown',
        glasses: false,
      },
      sheet: {
        apparentAge: 'about 5 years old',
        hair:
          ['short curly dark brown hair', 'straight light brown hair', 'wavy black hair'][shade] ??
          '',
        eyes: 'brown eyes',
        skinTone: ['light olive skin', 'fair skin', 'warm brown skin'][shade] ?? '',
        distinctiveFeatures: ['rosy cheeks'],
        clothing: 'a striped t-shirt',
      },
      usage: usage('mock-text'),
    });
  }
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

export class MockAIImageProvider implements AIImageProvider {
  readonly id = 'mock';

  /** Ilustración placeholder en SVG, determinista según el prompt y la semilla. */
  generateIllustration(request: IllustrationRequest): Promise<GeneratedImage> {
    const hash = sha256Hex(`${request.prompt}|${request.stylePrompt}|${String(request.seed)}`);
    const hue = parseInt(hash.slice(0, 2), 16);
    const [width, height] =
      request.aspectRatio === '3:4'
        ? [768, 1024]
        : request.aspectRatio === '4:3'
          ? [1024, 768]
          : [1024, 1024];
    const label = escapeXml(request.prompt.slice(0, 80));
    // <desc> lleva el prompt completo: la moderación y la revisión simuladas leen sus marcas.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><desc>${escapeXml(request.prompt)}</desc><rect width="100%" height="100%" fill="hsl(${hue} 60% 85%)"/><circle cx="${width / 2}" cy="${height / 2 - 80}" r="120" fill="hsl(${hue} 50% 60%)"/><text x="50%" y="${height - 120}" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#333">${label}</text></svg>`;
    return Promise.resolve({
      bytes: new TextEncoder().encode(svg),
      mimeType: 'image/svg+xml',
      usage: usage('mock-image'),
    });
  }

  moderateImage(image: ImageData): Promise<ModerationResult> {
    return Promise.resolve(moderate(new TextDecoder().decode(image.bytes)));
  }
}
