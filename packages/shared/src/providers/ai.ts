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
  return `child (${sheet.apparentAge.replace(/^(a\s+)?child,?\s*/i, '')}); hair: ${sheet.hair}; eyes: ${sheet.eyes}; skin tone: ${sheet.skinTone}${features}; outfit: ${sheet.clothing} (the same outfit as in the reference sheet on every page, unless the page text explicitly says the character changes clothes or the action is impossible in it, such as swimming or sleeping)`;
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
  /** 1K para pantalla; 2K para imprenta (~220 dpi a 21×28 cm). */
  resolution?: '1K' | '2K';
  /** Semilla para reproducibilidad, si el proveedor la soporta. */
  seed: number | null;
}

export interface GeneratedImage extends ImageData {
  usage: AiUsage;
}

/** Plan de una página (planificador editorial, guía A). */
export interface ScenePlan {
  pageIndex: number;
  sceneGoal: string;
  emotionalBeat: string;
  /** Lo que tiene que verse en la ilustración (en inglés). */
  mustBeVisible: string[];
  /** Lo que no tiene que aparecer (en inglés). */
  notVisible: string[];
  /** Hechos que no cambian de una página a otra (mascota, ropa, lugar...). */
  continuityFacts: string[];
  wordBudget: number;
  /** Qué detalle personal mueve la escena, si alguno. */
  personalDetail: string | null;
  /** Objetos de la biblia visual que aparecen en la escena (por nombre; ausente en planes anteriores). */
  props?: string[];
  /** Lugar de la biblia visual donde ocurre la escena (por nombre), o null. */
  place?: string | null;
  /** Ropa especial del protagonista en la escena (por contexto), o null: la de la lámina. */
  outfit?: string | null;
  /** Encuadre de la ilustración; nunca el mismo tres veces seguidas. */
  shot?: ShotType | null;
}

/** Encuadres que puede pedir el plan para variar las ilustraciones. */
export const SHOT_TYPES = ['wide', 'medium', 'close-up', 'high angle'] as const;

export type ShotType = (typeof SHOT_TYPES)[number];

/**
 * Objeto o lugar de la biblia visual: se describe una vez y se dibuja igual en todas las escenas
 * donde aparece (una tabla de kitesurf, el faro del pueblo).
 */
export interface VisualBibleItem {
  name: string;
  /** Aspecto fijo, en inglés. En actividades poco comunes, qué es y qué no es. */
  look: string;
}

/** Ropa del protagonista para un contexto (en el agua, de noche), con aspecto fijo en inglés. */
export interface OutfitPlan {
  context: string;
  look: string;
}

/** Personaje secundario que se repite (abuela, mascota): se dibuja igual en todo el libro. */
export interface CompanionPlan {
  name: string;
  /** Aspecto fijo, en inglés (edad, pelo, ropa y colores; especie y pelaje si es mascota). */
  look: string;
}

/**
 * Persona secundaria que aparece en varias páginas sin ser el acompañante principal (el profesor, un
 * compañero, un vecino). Se fija una vez, con su género y aspecto, para dibujarla igual en todas.
 */
export interface CastMember {
  /** Quién es (en inglés): «the teacher», «a classmate». */
  role: string;
  gender: 'male' | 'female' | 'unspecified';
  /** Aspecto fijo, en inglés (edad, pelo, ropa y colores). */
  look: string;
}

export interface StoryPlan {
  theme: string;
  /** Personas secundarias que se repiten, con género y aspecto fijos (vacío si no hay). */
  cast?: CastMember[];
  /** El acompañante que más se repite, o null si ninguno vuelve en varias páginas. */
  companion?: CompanionPlan | null;
  /** Biblia visual (ausente en planes anteriores): objetos, lugares y ropa que se repiten. */
  props?: VisualBibleItem[];
  places?: VisualBibleItem[];
  outfits?: OutfitPlan[];
  /** Principio, motivación, dificultad, decisión del protagonista y resolución. */
  arc: string;
  scenes: ScenePlan[];
  usage: AiUsage;
}

export const PAGE_REVIEW_STATUSES = ['pass', 'repair', 'human_review', 'needs_reference'] as const;

export type PageReviewStatus = (typeof PAGE_REVIEW_STATUSES)[number];

/** Revisión cruzada texto-imagen de una página (guía D). Nunca es una verificación biométrica. */
export interface PageReviewRequest {
  pageIndex: number;
  /** Texto aprobado de la página (null en la portada). */
  text: string | null;
  image: ImageData;
  /** Lámina aprobada del personaje: la referencia de continuidad. */
  reference: ImageData;
  /** Descripción del personaje con los rasgos que no pueden cambiar. */
  character: string;
  /** Rasgos esenciales, en inglés ("glasses: present", "hair: short curly black"). */
  mustKeep: readonly string[];
  scene: ScenePlan | null;
  /** Aspecto fijo de los objetos, el lugar y la ropa de esta escena (biblia visual), si hay. */
  visualBible?: string;
}

export interface ContinuityCheck {
  trait: string;
  expected: string;
  observed: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface PageReview {
  pageIndex: number;
  status: PageReviewStatus;
  criticalIssues: string[];
  nonCriticalIssues: string[];
  continuityChecks: ContinuityCheck[];
  imageTextMatches: boolean;
  /** Hay letras o palabras dentro de la ilustración. */
  textInImage: boolean;
  /** Qué arreglar: el texto aprobado nunca se cambia sin el adulto. */
  repairTarget: 'illustration_only' | 'text_only' | 'none';
  usage: AiUsage;
}

/** Actividad de un libro de actividades o mixto (se dibuja en la maquetación, fase 10). */
export interface ActivitySpec {
  kind: string;
  title: string;
  instructions: string;
  /** Elementos de la historia que usa la actividad (personajes, objetos, palabras). */
  items: string[];
  /** Escena para una ilustración de contorno, si la actividad la necesita (en inglés). */
  illustrationPrompt: string | null;
}

export interface ActivityRequest {
  language: Locale;
  childName: string;
  age: number;
  readingLevel: string;
  storyTitle: string;
  storyPages: readonly string[];
  /** Plantillas aprobadas para el nivel: tipo e indicaciones. */
  templates: readonly { kind: string; guidance: string }[];
  count: number;
  /** Profesionales: objetivo general elegido (nunca un protocolo clínico). */
  goal: string | null;
}

export interface GeneratedActivities {
  activities: ActivitySpec[];
  usage: AiUsage;
}

export interface AITextProvider {
  readonly id: string;
  /** Plan editorial por página antes de escribir (guía A). */
  planStory(request: StoryRequest): Promise<StoryPlan>;
  /** Revisión multimodal de una página ilustrada (guía D). */
  reviewPage(request: PageReviewRequest): Promise<PageReview>;
  /** Actividades a partir de plantillas aprobadas. */
  generateActivities(request: ActivityRequest): Promise<GeneratedActivities>;
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
