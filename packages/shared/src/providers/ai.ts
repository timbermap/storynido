import type { Language } from '../i18n';

/** Costo de una llamada, en millonésimas de dólar (precisión suficiente para tokens e imágenes). */
export interface AiUsage {
  provider: string;
  model: string;
  costUsdMicros: number;
}

export interface StoryRequest {
  language: Language;
  childName: string;
  age: number;
  pronouns: 'she' | 'he' | 'they' | null;
  likes: readonly string[];
  petName: string | null;
  bestFriendName: string | null;
  dedication: string | null;
  storyTitle: string;
  /** Plantilla editable desde el admin (stories.textPromptTemplate). */
  promptTemplate: string;
  pageCount: number;
}

export interface StoryPage {
  index: number;
  text: string;
  /** Descripción de la escena para generar la ilustración. */
  illustrationPrompt: string;
}

export interface GeneratedStory {
  title: string;
  pages: StoryPage[];
  usage: AiUsage;
}

export interface StoryReview {
  approved: boolean;
  issues: string[];
  /** Páginas corregidas (ortografía, coherencia, contenido apto para chicos). */
  pages: StoryPage[];
  usage: AiUsage;
}

export interface ModerationResult {
  allowed: boolean;
  /** Categorías que motivaron el rechazo (vacío si se permite). */
  categories: string[];
}

export interface ImageData {
  bytes: Uint8Array;
  mimeType: string;
}

/** Referencia del protagonista para que se vea igual en todas las páginas. */
export interface CharacterReference {
  /** Ficha de rasgos extraída de la foto (pelo, ojos, tono de piel...). */
  description: string;
  photo: ImageData | null;
}

export interface IllustrationRequest {
  prompt: string;
  /** Modificador del estilo elegido (illustrationStyles.promptModifier). */
  stylePrompt: string;
  character: CharacterReference;
  aspectRatio: '1:1' | '3:4' | '4:3';
  /** Semilla para reproducibilidad, si el proveedor la soporta. */
  seed: number | null;
}

export interface GeneratedImage extends ImageData {
  usage: AiUsage;
}

export interface AITextProvider {
  readonly id: string;
  generateStory(request: StoryRequest): Promise<GeneratedStory>;
  reviewStory(story: GeneratedStory, request: StoryRequest): Promise<StoryReview>;
  moderateText(text: string): Promise<ModerationResult>;
}

export interface AIImageProvider {
  readonly id: string;
  generateIllustration(request: IllustrationRequest): Promise<GeneratedImage>;
  moderateImage(image: ImageData): Promise<ModerationResult>;
}

/** Texto e imagen se eligen por separado desde el admin (aiConfig). */
export interface AIProvider {
  text: AITextProvider;
  image: AIImageProvider;
}
