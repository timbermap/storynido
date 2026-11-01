import { paletteKeySchema } from './art-direction';
import { z } from 'zod';

import {
  BOOK_LENGTHS,
  READING_LEVELS,
  TEXT_DENSITIES,
  bookLengthSchema,
  contentTypeSchema,
  readingLevelSchema,
  textDensitySchema,
} from './editorial';
import { channelSchema, personalizationSchema } from './channels';
import { CHILD_LIMITS } from './users';
import { bookFormatSchema, localizedSchema, timestampsSchema } from './common';

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** stories/{storyId}: temática/plantilla de historia. */
export const storySchema = timestampsSchema.extend({
  slug: slugSchema,
  active: z.boolean(),
  order: z.number().int(),
  ageMin: z.number().int().min(CHILD_LIMITS.minAge).max(CHILD_LIMITS.maxAge),
  ageMax: z.number().int().min(CHILD_LIMITS.minAge).max(CHILD_LIMITS.maxAge),
  tags: z.array(z.string()),
  /** Paleta de los libros de esta historia (sin ella, la del público; ver art-direction.ts). */
  palette: paletteKeySchema.nullish(),
  pageCount: z.number().int().positive(),
  title: localizedSchema(z.string().min(1)),
  summary: localizedSchema(z.string().min(1)),
  /**
   * Objetivos propios de la historia (Profesionales: "conocer el consultorio"…). Si los tiene,
   * reemplazan a los temas de la colección como objetivo y a las enseñanzas generales en la ficha.
   */
  objectives: z
    .array(localizedSchema(z.string().min(1)))
    .max(6)
    .optional(),
  /**
   * Enseñanzas que mejor encajan con el argumento (slugs de `lessons`, en orden). La ficha
   * muestra solo estas y el creador las ofrece primero; el resto sigue disponible.
   */
  suggestedLessons: z.array(slugSchema).max(6).optional(),
  /** Fragmento de muestra del texto, por idioma. */
  excerpt: localizedSchema(z.string().min(1)),
  /** Portada de muestra (ruta pública o del bucket de assets). */
  coverImage: z.string().min(1),
  /**
   * Portada nueva (rediseño de imágenes, DECISIONS 157): el tercio superior está vacío y el título
   * se superpone con la tipografía de la marca. Sin el flag, la portada se muestra tal cual.
   */
  coverTitleOverlay: z.boolean().default(false),
  /** Color del título sobre el fondo de la portada: oscuro (por defecto) o claro (fondos azul marino). */
  coverInk: z.enum(['dark', 'light']).default('dark'),
  /** Portada de la versión Profesionales de la misma historia (otro estilo y chico genérico). */
  coverImagePro: z.string().nullish(),
  /** Título de la versión Profesionales, sin el nombre del niño ("Mi primer día de clases"). */
  titlePro: localizedSchema(z.string().min(1)).nullish(),
  /** Nombre del elenco de la marca que protagoniza la portada y el fragmento de muestra. */
  castName: z.string().min(1).max(30).optional(),
  /** Estilo recomendado para esta historia en el asistente (slug de `illustrationStyles`). */
  defaultStyle: slugSchema.optional(),
  /** Imágenes de páginas de muestra. */
  samplePages: z.array(z.string()),
  textPromptTemplate: z.string().min(1),
  imagePromptTemplate: z.string().min(1),
  /** Opciones editoriales admitidas (las historias anteriores admiten todas). */
  lengths: z
    .array(bookLengthSchema)
    .min(1)
    .default([...BOOK_LENGTHS]),
  textDensities: z
    .array(textDensitySchema)
    .min(1)
    .default([...TEXT_DENSITIES]),
  readingLevels: z
    .array(readingLevelSchema)
    .min(1)
    .default([...READING_LEVELS]),
  contentTypes: z.array(contentTypeSchema).min(1).default(['story', 'story_activities']),
  /** Líneas en las que se ofrece (una misma historia puede estar en varias, sin duplicarla). */
  channels: z.array(channelSchema).min(1).default(['families']),
  /** Colecciones a las que pertenece (collections/{slug}). */
  collectionIds: z.array(z.string()).default([]),
  personalization: personalizationSchema.default({
    photo: true,
    avatar: true,
    memories: true,
    lessons: true,
  }),
});

export type Story = z.infer<typeof storySchema>;

/** illustrationStyles/{styleId} */
export const illustrationStyleSchema = timestampsSchema.extend({
  slug: slugSchema,
  active: z.boolean(),
  order: z.number().int(),
  name: localizedSchema(z.string().min(1)),
  promptModifier: z.string().min(1),
  sampleImage: z.string().nullable(),
  /** Tipos de contenido en los que se ofrece (el estilo de contornos es solo para colorear). */
  contentTypes: z
    .array(contentTypeSchema)
    .min(1)
    .default(['story', 'activities', 'story_activities']),
});

export type IllustrationStyle = z.infer<typeof illustrationStyleSchema>;

export const LESSON_GROUPS = ['values', 'confidence', 'life', 'emotions'] as const;

export const lessonGroupSchema = z.enum(LESSON_GROUPS);

export type LessonGroup = z.infer<typeof lessonGroupSchema>;

/**
 * lessons/{lessonId}: enseñanza o mensaje que la IA teje en cualquier aventura
 * ("compartir", "llega un hermanito"). Se combina con la historia elegida.
 */
export const lessonSchema = timestampsSchema.extend({
  slug: slugSchema,
  active: z.boolean(),
  order: z.number().int(),
  group: lessonGroupSchema,
  ageMin: z.number().int().min(CHILD_LIMITS.minAge).max(CHILD_LIMITS.maxAge),
  ageMax: z.number().int().min(CHILD_LIMITS.minAge).max(CHILD_LIMITS.maxAge),
  /** Nombre corto ("Llega un hermanito"). */
  name: localizedSchema(z.string().min(1)),
  /** Titular para su página ("Un cuento para recibir a su hermanito"). */
  headline: localizedSchema(z.string().min(1)),
  description: localizedSchema(z.string().min(1)),
  /** Indicaciones para la IA: cómo integrar el mensaje sin sermonear. */
  promptGuidance: z.string().min(1),
  /** Temas que requieren revisión humana (pérdidas, separaciones). Fuera del lanzamiento. */
  sensitive: z.boolean(),
  /** La historia hecha para esta enseñanza (slug): va primero y destacada en su página. */
  featuredStory: slugSchema.optional(),
});

export type Lesson = z.infer<typeof lessonSchema>;

/** products/{productId}: formato vendible. */
export const productSchema = timestampsSchema.extend({
  format: bookFormatSchema,
  pageCount: z.number().int().positive(),
  active: z.boolean(),
  name: localizedSchema(z.string().min(1)),
});

export type Product = z.infer<typeof productSchema>;

/**
 * Etapas de lectura del catálogo (DECISIONS 149 y 158): 0–2, 3–5, 6–8 y 9–12, sin que se pisen.
 * Cada historia pertenece a la etapa que contiene el centro de su rango de edad.
 */
export const AGE_STAGES = [
  { key: 'babies', min: 0, max: 2 },
  { key: 'little', min: 3, max: 5 },
  { key: 'readers', min: 6, max: 8 },
  { key: 'big', min: 9, max: 12 },
] as const;

export type AgeStageKey = (typeof AGE_STAGES)[number]['key'];

export function stageOf(story: { ageMin: number; ageMax: number }): AgeStageKey {
  const middle = (story.ageMin + story.ageMax) / 2;
  if (middle < 3) return 'babies';
  if (middle < 6) return 'little';
  if (middle < 9) return 'readers';
  return 'big';
}

/**
 * Estilo recomendado por etapa y línea (estudio de estilos, DECISIONS 158): bebés con color saturado y
 * formas simples (collage), 3–5 y 6–8 en gouache (6–8 con recursos de historieta en la dirección de arte),
 * 9+ con tinta y color plano (cuento clásico, hasta tener el estilo de novela gráfica). Profesionales
 * usa siempre el minimalismo gráfico.
 */
export function recommendedStyle(story: {
  channels: readonly string[];
  ageMin: number;
  ageMax: number;
}): string {
  if (story.channels[0] === 'professionals') return 'minimalismo-grafico';
  const stage = stageOf(story);
  if (stage === 'babies') return 'collage-papel';
  if (stage === 'big') return 'cuento-clasico';
  return 'gouache-editorial';
}

/** Marca del nombre en los títulos del catálogo ("[Nombre] y el valle de los dinosaurios"). */
const NAME_PLACEHOLDER = /\[(?:Nombre|Name|Nome)\]/g;

/**
 * Parte un título con la marca del nombre en lo que va antes y después ("La aventura de [Nombre]"
 * → "La aventura de" y ""). Sin marca devuelve null.
 */
export function splitTitleAtName(title: string): { before: string; after: string } | null {
  const match = /\[(?:Nombre|Name|Nome)\]/.exec(title);
  if (!match) return null;
  return {
    before: title.slice(0, match.index).trim(),
    after: title.slice(match.index + match[0].length).trim(),
  };
}

/**
 * Nombres del elenco por idioma (auditoría de historias): los que no viajan se adaptan
 * (Tomás → Tom en inglés, Benja → Ben y Benjamim). Lola, Alex, Sofi y Martina sirven en los tres.
 */
const CAST_NAMES: Record<string, Partial<Record<'es' | 'en' | 'pt', string>>> = {
  Tomás: { en: 'Tom' },
  Benja: { en: 'Ben', pt: 'Benjamim' },
};

export function castNameFor(name: string, locale: 'es' | 'en' | 'pt'): string {
  return CAST_NAMES[name]?.[locale] ?? name;
}

/** Nombre de ejemplo (neutro) para mostrar los títulos del catálogo antes de que se escriba el nombre. */
export const EXAMPLE_CHILD_NAME = 'Alex';

/** El título con el nombre del niño en el lugar de la marca (para el prompt y el libro). */
export function withChildName(title: string, name: string): string {
  return title.replace(NAME_PLACEHOLDER, name);
}
