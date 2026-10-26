import type {
  AIImageProvider,
  AITextProvider,
  AiUsage,
  GeneratedImage,
  GeneratedStory,
  IllustrationRequest,
  ImageData,
  Locale,
  ModerationResult,
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

const usage = (model: string): AiUsage => ({ provider: 'mock', model, costUsdMicros: 0 });

function moderate(text: string): ModerationResult {
  return text.includes(MOCK_UNSAFE_MARKER)
    ? { allowed: false, categories: ['mock_unsafe'] }
    : { allowed: true, categories: [] };
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
      return {
        index,
        text: PHRASES[request.language](request.childName, like, index + 1),
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
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="hsl(${hue} 60% 85%)"/><circle cx="${width / 2}" cy="${height / 2 - 80}" r="120" fill="hsl(${hue} 50% 60%)"/><text x="50%" y="${height - 120}" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#333">${label}</text></svg>`;
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
