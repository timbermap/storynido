import { z } from 'zod';

import { bookFormatSchema } from './common';

/** Extensión del libro (docs/estrategia/LINEAS-COMERCIALES.md §3). */
export const BOOK_LENGTHS = ['mini', 'short', 'classic', 'epic'] as const;
/** Cantidad de texto por página narrativa (§4), independiente de la extensión. */
export const TEXT_DENSITIES = ['visual', 'balanced', 'rich'] as const;
/** Nivel de lectura (§5), independiente de la edad, la extensión y la densidad. */
export const READING_LEVELS = ['beginner', 'developing', 'advanced'] as const;
/** Tipo de contenido (§6). */
export const CONTENT_TYPES = ['story', 'coloring', 'activities', 'story_activities'] as const;

export const bookLengthSchema = z.enum(BOOK_LENGTHS);
export const textDensitySchema = z.enum(TEXT_DENSITIES);
export const readingLevelSchema = z.enum(READING_LEVELS);
export const contentTypeSchema = z.enum(CONTENT_TYPES);

export type BookLength = z.infer<typeof bookLengthSchema>;
export type TextDensity = z.infer<typeof textDensitySchema>;
export type ReadingLevel = z.infer<typeof readingLevelSchema>;
export type ContentType = z.infer<typeof contentTypeSchema>;

const lengthConfigSchema = z
  .object({
    /** Páginas interiores totales (sin tapas). */
    interiorPages: z.number().int().min(4).max(64),
    /** Páginas fijas que no escribe la IA: dedicatoria y cierre. */
    fixedPages: z.number().int().min(0).max(8),
    /** Proporción de páginas de actividades en el formato mixto. */
    activityShare: z.number().min(0).max(0.6),
    /**
     * Formatos en los que se puede producir. Se valida contra la imprenta real (fase 12):
     * hasta entonces, lo que no está confirmado se ofrece solo en digital.
     */
    formats: z.array(bookFormatSchema).min(1),
    active: z.boolean(),
  })
  .refine((value) => value.interiorPages > value.fixedPages + 1, {
    message: 'Tiene que quedar al menos 2 páginas narrativas',
  });

/** editorialConfig/global: editable desde el admin (fase 14). */
export const editorialConfigSchema = z.object({
  lengths: z.record(bookLengthSchema, lengthConfigSchema),
  densities: z.record(
    textDensitySchema,
    z
      .object({ minWords: z.number().int().min(1), maxWords: z.number().int().min(1) })
      .refine((value) => value.maxWords >= value.minWords, { message: 'maxWords < minWords' }),
  ),
  /** Indicaciones para la IA por nivel (en español, como el resto del prompt). */
  levels: z.record(readingLevelSchema, z.object({ guidance: z.string().min(1) })),
  contentTypes: z.record(contentTypeSchema, z.object({ active: z.boolean() })),
  /** Valores por defecto de Familias. */
  defaults: z.object({
    length: bookLengthSchema,
    textDensity: textDensitySchema,
    readingLevel: readingLevelSchema,
    contentType: contentTypeSchema,
  }),
});

export type EditorialConfig = z.infer<typeof editorialConfigSchema>;

export const DEFAULT_EDITORIAL_CONFIG: EditorialConfig = {
  lengths: {
    mini: {
      interiorPages: 12,
      fixedPages: 2,
      activityShare: 0.25,
      formats: ['digital', 'booklet'],
      active: true,
    },
    short: {
      interiorPages: 16,
      fixedPages: 2,
      activityShare: 0.25,
      formats: ['digital', 'booklet'],
      active: true,
    },
    classic: {
      // 28: el mínimo de los fotolibros de Gelato (28 a 200 páginas, pares). DECISIONS 076.
      interiorPages: 28,
      fixedPages: 2,
      activityShare: 0.25,
      formats: ['digital', 'softcover', 'hardcover'],
      active: true,
    },
    epic: {
      interiorPages: 32,
      fixedPages: 2,
      activityShare: 0.25,
      formats: ['digital', 'softcover', 'hardcover'],
      active: true,
    },
  },
  densities: {
    visual: { minWords: 5, maxWords: 20 },
    balanced: { minWords: 25, maxWords: 60 },
    rich: { minWords: 70, maxWords: 120 },
  },
  levels: {
    beginner: {
      guidance:
        'Vocabulario muy cotidiano y concreto, oraciones cortas de una sola idea, repetición de palabras y estructuras (estribillos), trama lineal sin saltos de tiempo.',
    },
    developing: {
      guidance:
        'Vocabulario cotidiano con algunas palabras nuevas que se entienden por el contexto, oraciones simples y algunas compuestas, diálogos breves, trama con un problema y su solución.',
    },
    advanced: {
      guidance:
        'Vocabulario más rico y descriptivo, oraciones compuestas variadas, diálogos, emociones de los personajes y una trama con giros y un cierre que invita a conversar.',
    },
  },
  contentTypes: {
    story: { active: true },
    coloring: { active: true },
    activities: { active: true },
    story_activities: { active: true },
  },
  defaults: {
    length: 'classic',
    textDensity: 'balanced',
    readingLevel: 'developing',
    contentType: 'story',
  },
};

/**
 * Sugerencias según la edad (el adulto puede cambiarlas en "Ajustar"): los bebés, libros cortos y
 * muy visuales; desde los 6 años, 32 páginas con más texto (docs "Cantidad de texto por edad").
 */
export function suggestedReading(age: number): {
  length: BookLength;
  textDensity: TextDensity;
  readingLevel: ReadingLevel;
} {
  // El formato recomendado de la edad (siempre hay uno: los rangos cubren de 0 en adelante).
  const format = readingFormatsFor(age)[0] ?? READING_FORMATS[0];
  return {
    length: format.length,
    textDensity: format.textDensity,
    readingLevel: format.readingLevel,
  };
}

/**
 * "¿Cómo lo van a leer?": formatos editoriales reconocibles por edad (docs "Cantidad de texto por
 * edad"). Cada uno fija extensión, cantidad de texto y nivel; el adulto ve solo los de la edad de
 * su hijo. Los de capítulos y la historieta necesitan otra maquetación y todavía no están.
 */
export const READING_FORMATS = [
  {
    key: 'first_words',
    minAge: 0,
    maxAge: 2,
    length: 'short',
    textDensity: 'visual',
    readingLevel: 'beginner',
    recommended: true,
  },
  {
    key: 'look_and_tell',
    minAge: 3,
    maxAge: 5,
    length: 'short',
    textDensity: 'visual',
    readingLevel: 'beginner',
    recommended: false,
  },
  {
    key: 'read_together_little',
    minAge: 3,
    maxAge: 5,
    length: 'classic',
    textDensity: 'balanced',
    readingLevel: 'developing',
    recommended: true,
  },
  {
    key: 'long_night_story',
    minAge: 3,
    maxAge: 5,
    length: 'epic',
    textDensity: 'balanced',
    readingLevel: 'developing',
    recommended: false,
  },
  {
    key: 'read_together',
    minAge: 6,
    maxAge: 8,
    length: 'classic',
    textDensity: 'balanced',
    readingLevel: 'developing',
    recommended: false,
  },
  {
    key: 'read_alone',
    minAge: 6,
    maxAge: 8,
    length: 'epic',
    textDensity: 'balanced',
    readingLevel: 'developing',
    recommended: true,
  },
  {
    key: 'longer_story',
    minAge: 6,
    maxAge: 8,
    length: 'epic',
    textDensity: 'rich',
    readingLevel: 'developing',
    recommended: false,
  },
  {
    key: 'long_illustrated',
    minAge: 9,
    maxAge: 99,
    length: 'epic',
    textDensity: 'rich',
    readingLevel: 'advanced',
    recommended: true,
  },
  // Desde 9 años también hay formatos más cortos (antes el largo era el único).
  {
    key: 'short_story',
    minAge: 9,
    maxAge: 99,
    length: 'short',
    textDensity: 'balanced',
    readingLevel: 'advanced',
    recommended: false,
  },
  {
    key: 'illustrated_story',
    minAge: 9,
    maxAge: 99,
    length: 'classic',
    textDensity: 'balanced',
    readingLevel: 'advanced',
    recommended: false,
  },
] as const satisfies readonly {
  key: string;
  minAge: number;
  maxAge: number;
  length: BookLength;
  textDensity: TextDensity;
  readingLevel: ReadingLevel;
  recommended: boolean;
}[];

export type ReadingFormat = (typeof READING_FORMATS)[number];

/** Formatos de la edad (el recomendado primero); vacío si no hay edad. */
export function readingFormatsFor(age: number | null): ReadingFormat[] {
  if (age === null) return [];
  return READING_FORMATS.filter((format) => format.minAge <= age && age <= format.maxAge).toSorted(
    (a, b) => Number(b.recommended) - Number(a.recommended),
  );
}

export interface EditorialChoice {
  length: BookLength | null;
  textDensity: TextDensity;
  readingLevel: ReadingLevel;
  contentType: ContentType;
}

export interface EditorialPlan extends EditorialChoice {
  /** Páginas interiores del libro terminado. */
  interiorPages: number;
  /** Páginas que escribe e ilustra la IA. */
  narrativePages: number;
  /** Páginas de actividades (formato mixto o libro de actividades). */
  activityPages: number;
  words: { min: number; max: number };
  levelGuidance: string;
}

/**
 * Plan editorial del libro. Los libros anteriores (sin extensión) conservan el `pageCount`
 * de su historia como páginas narrativas, para no cambiar lo que ya se generó.
 */
export function editorialPlan(
  choice: EditorialChoice,
  config: EditorialConfig,
  legacyPageCount: number,
): EditorialPlan {
  const density =
    choice.contentType === 'coloring'
      ? config.densities.visual
      : config.densities[choice.textDensity];
  const level = config.levels[choice.readingLevel];
  if (!choice.length) {
    return {
      ...choice,
      interiorPages: legacyPageCount,
      narrativePages: legacyPageCount,
      activityPages: 0,
      words: { min: density.minWords, max: density.maxWords },
      levelGuidance: level.guidance,
    };
  }
  const length = config.lengths[choice.length];
  const available = length.interiorPages - length.fixedPages;
  const activityPages =
    choice.contentType === 'activities'
      ? available
      : choice.contentType === 'story_activities'
        ? Math.max(1, Math.round(available * length.activityShare))
        : 0;
  return {
    ...choice,
    interiorPages: length.interiorPages,
    narrativePages: Math.max(
      choice.contentType === 'activities' ? 0 : 2,
      available - activityPages,
    ),
    activityPages,
    words: { min: density.minWords, max: density.maxWords },
    levelGuidance: level.guidance,
  };
}

/** Tope de palabras por página del mini cuento de Celebraciones: un librito breve, para leer en la fiesta. */
export const EVENT_MAX_WORDS_PER_PAGE = 60;

/**
 * Eventos: el mini cuento no pasa de ~60 palabras por página (con la densidad «rica» salían ~120 y
 * el texto tapaba la ilustración). El mínimo baja para que el rango siga siendo válido.
 */
export function withEventWordCap<T extends { words: { min: number; max: number } }>(
  plan: T,
  isEvent: boolean,
): T {
  if (!isEvent) return plan;
  const max = Math.min(plan.words.max, EVENT_MAX_WORDS_PER_PAGE);
  return { ...plan, words: { min: Math.min(plan.words.min, Math.round(max * 0.6)), max } };
}

/** Palabras de un texto (para validar la densidad). */
export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/u)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/**
 * Páginas fuera del rango de palabras, con un margen (el modelo no cuenta exacto):
 * 40 % por debajo del mínimo o 30 % por encima del máximo.
 */
export function pagesOutOfRange(
  pages: readonly { text: string }[],
  words: { min: number; max: number },
): number[] {
  return pages.flatMap((page, index) => {
    const count = countWords(page.text);
    return count < Math.floor(words.min * 0.6) || count > Math.ceil(words.max * 1.3) ? [index] : [];
  });
}

/** Actividades aprobadas (se generan y maquetan en las fases 09 y 10). */
export const ACTIVITY_KINDS = [
  'maze',
  'match',
  'differences',
  'complete_sentence',
  'draw_ending',
] as const;

export const activityTemplateSchema = z.object({
  kind: z.enum(ACTIVITY_KINDS),
  active: z.boolean(),
  readingLevels: z.array(readingLevelSchema).min(1),
  /** Indicaciones para generar la actividad a partir de la historia. */
  promptGuidance: z.string().min(1),
});

export type ActivityTemplate = z.infer<typeof activityTemplateSchema>;

/**
 * Páginas con ilustración generada de un libro ya armado (DECISIONS 241): las que pagan IA y
 * margen por página. No cuentan las fijas de la extensión ni las de actividades que arma el
 * sistema. Es la misma cuenta que `editorialPlan` (`narrativePages`).
 */
export function generatedPages(
  book: {
    length: BookLength | null;
    contentType?: ContentType | null;
    interiorPages: number;
    activityPages?: number | null;
  },
  config: EditorialConfig,
): number {
  // Libros anteriores a las extensiones: todas sus páginas son de la historia.
  if (!book.length) return Math.max(0, book.interiorPages);
  const available = book.interiorPages - config.lengths[book.length].fixedPages;
  return Math.max(
    book.contentType === 'activities' ? 0 : 2,
    available - (book.activityPages ?? 0),
  );
}
