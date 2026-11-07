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
/**
 * Franjas de edad de la cantidad de texto (docs «Cuentos que cuidan»): la edad elige la franja y
 * el adulto puede subir o bajar un escalón en «Ajustar» (la densidad), nunca más.
 */
export const AGE_BANDS = ['0-2', '3-4', '5-6', '7-8', '9+'] as const;

export const bookLengthSchema = z.enum(BOOK_LENGTHS);
export const textDensitySchema = z.enum(TEXT_DENSITIES);
export const readingLevelSchema = z.enum(READING_LEVELS);
export const contentTypeSchema = z.enum(CONTENT_TYPES);
export const ageBandSchema = z.enum(AGE_BANDS);

export type BookLength = z.infer<typeof bookLengthSchema>;
export type TextDensity = z.infer<typeof textDensitySchema>;
export type ReadingLevel = z.infer<typeof readingLevelSchema>;
export type ContentType = z.infer<typeof contentTypeSchema>;
export type AgeBand = z.infer<typeof ageBandSchema>;

/** Edades de cada franja (fijas: la franja de 9 en adelante llega hasta los 12 del perfil y más). */
export const AGE_BAND_RANGES: Record<AgeBand, { minAge: number; maxAge: number }> = {
  '0-2': { minAge: 0, maxAge: 2 },
  '3-4': { minAge: 3, maxAge: 4 },
  '5-6': { minAge: 5, maxAge: 6 },
  '7-8': { minAge: 7, maxAge: 8 },
  '9+': { minAge: 9, maxAge: 99 },
};

/** Franja de una edad (las edades negativas o raras caen en la más cercana). */
export function ageBandOf(age: number): AgeBand {
  return AGE_BANDS.find((band) => age <= AGE_BAND_RANGES[band].maxAge) ?? '9+';
}

/**
 * Escalón que mueve la densidad elegida en «Ajustar»: poco texto baja una franja, mucho texto sube
 * una. Así el adulto nunca se aleja más de un escalón de lo que corresponde a la edad.
 */
export const DENSITY_STEP: Record<TextDensity, -1 | 0 | 1> = { visual: -1, balanced: 0, rich: 1 };

/** Franja de texto: la de la edad, movida a lo sumo un escalón por la densidad. */
export function textBandFor(age: number, density: TextDensity): AgeBand {
  const index = AGE_BANDS.indexOf(ageBandOf(age)) + DENSITY_STEP[density];
  return AGE_BANDS[Math.min(Math.max(index, 0), AGE_BANDS.length - 1)] ?? '9+';
}

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

const ageBandWordsSchema = z
  .object({
    /** 0 en los bebés: una página puede ser solo la ilustración. */
    minWords: z.number().int().min(0),
    maxWords: z.number().int().min(1),
    /** Tope duro: la página que lo pasa se reescribe (una vez) con el modelo. */
    capWords: z.number().int().min(1),
    /** Páginas de cuento sugeridas (orientativas: las extensiones reales salen de `lengths`). */
    minPages: z.number().int().min(1),
    maxPages: z.number().int().min(1),
  })
  .refine((value) => value.maxWords >= value.minWords, { message: 'maxWords < minWords' })
  .refine((value) => value.capWords >= value.maxWords, { message: 'capWords < maxWords' })
  .refine((value) => value.maxPages >= value.minPages, { message: 'maxPages < minPages' });

export type AgeBandWords = z.infer<typeof ageBandWordsSchema>;

/** Tabla «Cuánto texto por edad» (docs «Cuentos que cuidan», 05/11). */
export const DEFAULT_AGE_BANDS: Record<AgeBand, AgeBandWords> = {
  '0-2': { minWords: 0, maxWords: 8, capWords: 10, minPages: 10, maxPages: 12 },
  '3-4': { minWords: 10, maxWords: 25, capWords: 30, minPages: 12, maxPages: 20 },
  '5-6': { minWords: 20, maxWords: 40, capWords: 50, minPages: 16, maxPages: 24 },
  '7-8': { minWords: 40, maxWords: 70, capWords: 80, minPages: 20, maxPages: 26 },
  '9+': { minWords: 70, maxWords: 120, capWords: 140, minPages: 24, maxPages: 30 },
};

/** editorialConfig/global: editable desde el admin (fase 14). */
export const editorialConfigSchema = z.object({
  lengths: z.record(bookLengthSchema, lengthConfigSchema),
  densities: z.record(
    textDensitySchema,
    z
      .object({ minWords: z.number().int().min(1), maxWords: z.number().int().min(1) })
      .refine((value) => value.maxWords >= value.minWords, { message: 'maxWords < minWords' }),
  ),
  /**
   * Palabras por página por franja de edad (rango y tope duro: la página que pasa el tope se
   * reescribe) y páginas de cuento sugeridas. Los documentos anteriores sin este campo usan los
   * valores de fábrica.
   */
  ageBands: z.record(ageBandSchema, ageBandWordsSchema).default(() => DEFAULT_AGE_BANDS),
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
  ageBands: DEFAULT_AGE_BANDS,
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
 * muy visuales; cuanto más grande, más páginas y más texto (docs "Cantidad de texto por edad").
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
 * edad"). Cada uno fija extensión, densidad y nivel. La densidad es un escalón sobre la franja de
 * la edad (`textBandFor`): `balanced` es lo que corresponde a la edad; `visual`, una franja menos;
 * `rich`, una más. Extensiones (páginas de cuento): mini 10, short 14, classic 26, epic 30; se
 * elige la más cercana a las páginas sugeridas de la franja sin tocar las reglas de la imprenta.
 */
export const READING_FORMATS = [
  {
    key: 'first_words',
    minAge: 0,
    maxAge: 2,
    length: 'mini',
    textDensity: 'balanced',
    readingLevel: 'beginner',
    recommended: true,
  },
  {
    key: 'look_and_tell',
    minAge: 3,
    maxAge: 4,
    length: 'mini',
    textDensity: 'visual',
    readingLevel: 'beginner',
    recommended: false,
  },
  {
    key: 'read_together_little',
    minAge: 3,
    maxAge: 4,
    length: 'short',
    textDensity: 'balanced',
    readingLevel: 'beginner',
    recommended: true,
  },
  {
    key: 'long_night_story',
    minAge: 3,
    maxAge: 4,
    length: 'short',
    textDensity: 'rich',
    readingLevel: 'developing',
    recommended: false,
  },
  {
    key: 'read_together',
    minAge: 5,
    maxAge: 8,
    length: 'classic',
    textDensity: 'balanced',
    readingLevel: 'developing',
    recommended: true,
  },
  {
    // «Leo solo»: frases cortas (una franja menos de texto), no un libro más largo.
    key: 'read_alone',
    minAge: 5,
    maxAge: 8,
    length: 'classic',
    textDensity: 'visual',
    readingLevel: 'beginner',
    recommended: false,
  },
  {
    key: 'longer_story',
    minAge: 5,
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
    textDensity: 'balanced',
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

/** Rango de palabras por página y tope duro. `cap` falta en los libros anteriores a las franjas. */
export interface WordRange {
  min: number;
  max: number;
  cap?: number;
}

/** Palabras por página para una edad y una densidad (la franja de la edad ± un escalón). */
export function wordsForAge(
  age: number,
  density: TextDensity,
  config: Pick<EditorialConfig, 'ageBands'>,
): Required<WordRange> {
  const band = config.ageBands[textBandFor(age, density)];
  return { min: band.minWords, max: band.maxWords, cap: band.capWords };
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
  words: WordRange;
  levelGuidance: string;
  /**
   * Franja de la edad del lector (tipografía y reglas de forma) y franja del texto (la de la edad
   * movida por la densidad). Faltan si no se conoce la edad: se usan las densidades de siempre.
   */
  ageBand?: AgeBand;
  textBand?: AgeBand;
}

/**
 * Plan editorial del libro. Con la edad, las palabras salen de su franja (± un escalón por la
 * densidad); sin edad, de las densidades de siempre. Los libros anteriores (sin extensión)
 * conservan el `pageCount` de su historia como páginas narrativas, para no cambiar lo generado.
 */
export function editorialPlan(
  choice: EditorialChoice,
  config: EditorialConfig,
  legacyPageCount: number,
  age: number | null = null,
): EditorialPlan {
  // Para colorear siempre hay poco texto (un escalón menos, como la densidad visual).
  const density: TextDensity = choice.contentType === 'coloring' ? 'visual' : choice.textDensity;
  const byAge =
    age === null || !Number.isFinite(age)
      ? null
      : {
          words: wordsForAge(age, density, config),
          ageBand: ageBandOf(age),
          textBand: textBandFor(age, density),
        };
  const legacy = config.densities[density];
  const words: WordRange = byAge?.words ?? { min: legacy.minWords, max: legacy.maxWords };
  const level = config.levels[choice.readingLevel];
  const bands = byAge ? { ageBand: byAge.ageBand, textBand: byAge.textBand } : {};
  if (!choice.length) {
    return {
      ...choice,
      interiorPages: legacyPageCount,
      narrativePages: legacyPageCount,
      activityPages: 0,
      words,
      levelGuidance: level.guidance,
      ...bands,
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
    words,
    levelGuidance: level.guidance,
    ...bands,
  };
}

/** Tope del mini cuento de Celebraciones cuando no se conoce la edad (el de antes de las franjas). */
export const EVENT_MAX_WORDS_PER_PAGE = 60;

/**
 * Eventos: el mini cuento no pasa del tope de la edad que celebra (30 palabras en un cumple de 4;
 * 60 si no se sabe la edad), aunque el adulto haya subido un escalón. El mínimo baja para que el
 * rango siga siendo válido.
 */
export function withEventWordCap<T extends { words: WordRange }>(
  plan: T,
  isEvent: boolean,
  age: number | null = null,
  config: Pick<EditorialConfig, 'ageBands'> = DEFAULT_EDITORIAL_CONFIG,
): T {
  if (!isEvent) return plan;
  const cap =
    age === null || !Number.isFinite(age)
      ? EVENT_MAX_WORDS_PER_PAGE
      : config.ageBands[ageBandOf(age)].capWords;
  const max = Math.min(plan.words.max, cap);
  const words: WordRange = { min: Math.min(plan.words.min, Math.round(max * 0.6)), max };
  if (plan.words.cap !== undefined) words.cap = Math.min(plan.words.cap, cap);
  return { ...plan, words };
}

/** Palabras de un texto (para validar la densidad). */
export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/u)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/** Tope duro de una página: el de la franja o, en los libros anteriores, el máximo + 30 %. */
export function wordCap(words: WordRange): number {
  return words.cap ?? Math.ceil(words.max * 1.3);
}

/**
 * Páginas fuera del rango de palabras, con un margen (el modelo no cuenta exacto): 40 % por
 * debajo del mínimo o por encima del tope. Las páginas sin texto que pidió el plan (`wordless`)
 * no cuentan.
 */
export function pagesOutOfRange(
  pages: readonly { text: string }[],
  words: WordRange,
  wordless: readonly number[] = [],
): number[] {
  return pages.flatMap((page, index) => {
    const count = countWords(page.text);
    if (count === 0 && wordless.includes(index)) return [];
    return count < Math.floor(words.min * 0.6) || count > wordCap(words) ? [index] : [];
  });
}

/** Páginas que pasan el tope duro de palabras: se reescriben (una vez) con el modelo. */
export function pagesOverCap(pages: readonly { text: string }[], words: WordRange): number[] {
  const cap = wordCap(words);
  return pages.flatMap((page, index) => (countWords(page.text) > cap ? [index] : []));
}

/** Franjas con páginas sin texto en el clímax (3 a 6 años: «Cuentos que cuidan»). */
export const WORDLESS_AGE_BANDS: readonly AgeBand[] = ['3-4', '5-6'];

/**
 * Páginas sin texto del plan, saneadas: solo de 3 a 6 años, nunca la primera ni la última, a lo
 * sumo 2 y nunca dos seguidas. Devuelve los índices que quedan sin texto.
 */
export function wordlessPages(
  scenes: readonly { pageIndex: number; wordless?: boolean | null }[],
  age: number,
): number[] {
  if (!WORDLESS_AGE_BANDS.includes(ageBandOf(age))) return [];
  const last = scenes.length - 1;
  const picked: number[] = [];
  for (const scene of scenes) {
    if (!scene.wordless || scene.pageIndex <= 0 || scene.pageIndex >= last) continue;
    if (picked.includes(scene.pageIndex - 1)) continue;
    picked.push(scene.pageIndex);
    if (picked.length === 2) break;
  }
  return picked;
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
  return Math.max(book.contentType === 'activities' ? 0 : 2, available - (book.activityPages ?? 0));
}
