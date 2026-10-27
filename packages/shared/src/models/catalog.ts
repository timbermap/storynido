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
  pageCount: z.number().int().positive(),
  title: localizedSchema(z.string().min(1)),
  summary: localizedSchema(z.string().min(1)),
  /** Fragmento de muestra del texto, por idioma. */
  excerpt: localizedSchema(z.string().min(1)),
  /** Portada de muestra (ruta pública o del bucket de assets). */
  coverImage: z.string().min(1),
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
