import type { Avatar } from '../models/character';
import type { Locale } from '../i18n';

/** Costo de una llamada, en millonésimas de dólar (precisión suficiente para tokens e imágenes). */
export interface AiUsage {
  provider: string;
  model: string;
  costUsdMicros: number;
}

export interface StoryRequest {
  language: Locale;
  childName: string;
  age: number;
  pronouns: 'she' | 'he' | 'they' | null;
  likes: readonly string[];
  petName: string | null;
  bestFriendName: string | null;
  dedication: string | null;
  storyTitle: string;
  /** Enseñanzas en orden de importancia (la primera es la principal). */
  lessons: readonly LessonPrompt[];
  /** Prompt ya armado con la plantilla de la historia (stories.textPromptTemplate). */
  prompt: string;
  pageCount: number;
  /** Rango de palabras por página (densidad de texto). */
  wordsPerPage?: { min: number; max: number };
  /** Nombres que tienen que aparecer tal cual (protagonista y apodo). */
  mustInclude?: readonly string[];
}

/** Enseñanza que la IA teje en la trama sin sermonear. */
export interface LessonPrompt {
  name: string;
  /** Indicaciones (lessons.promptGuidance) o el mensaje propio del adulto, ya moderado. */
  guidance: string;
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
  /** Costo de la moderación (sin costo en los mocks). */
  usage?: AiUsage;
}

export interface ImageData {
  bytes: Uint8Array;
  mimeType: string;
}

/** Ficha del personaje: rasgos visibles extraídos de la foto, en inglés para los modelos de imagen. */
export interface CharacterSheet {
  apparentAge: string;
  hair: string;
  eyes: string;
  skinTone: string;
  /** Rasgos distintivos (anteojos, pecas, hoyuelos...). Vacío si no hay. */
  distinctiveFeatures: string[];
  /** Ropa de la foto, como sugerencia de vestuario. */
  clothing: string;
}

export interface CharacterSheetResult {
  sheet: CharacterSheet;
  /** Rasgos estructurados estimados, para que el adulto los confirme o corrija. */
  traits: Avatar;
  usage: AiUsage;
}

/** Ficha en una frase, para incluir en los prompts de imagen. */
export function describeCharacterSheet(sheet: CharacterSheet): string {
  const features = sheet.distinctiveFeatures.length
    ? `; distinctive features: ${sheet.distinctiveFeatures.join(', ')}`
    : '';
  return `child (${sheet.apparentAge.replace(/^(a\s+)?child,?\s*/i, '')}); hair: ${sheet.hair}; eyes: ${sheet.eyes}; skin tone: ${sheet.skinTone}${features}; usually wears ${sheet.clothing}`;
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
  /** Ilustraciones ya generadas del mismo libro (p. ej. la portada) para mantener la consistencia. */
  references: readonly ImageData[];
  aspectRatio: '1:1' | '3:4' | '4:3';
  /** Semilla para reproducibilidad, si el proveedor la soporta. */
  seed: number | null;
}

export interface GeneratedImage extends ImageData {
  usage: AiUsage;
}

export interface AITextProvider {
  readonly id: string;
  /** Extrae la ficha del personaje a partir de la foto procesada. */
  describeCharacter(photo: ImageData): Promise<CharacterSheetResult>;
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
