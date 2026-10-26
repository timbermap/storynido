import { z } from 'zod';

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
  /** Rutas de imágenes de muestra en el bucket de assets. */
  samplePages: z.array(z.string()),
  textPromptTemplate: z.string().min(1),
  imagePromptTemplate: z.string().min(1),
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
});

export type IllustrationStyle = z.infer<typeof illustrationStyleSchema>;

/** products/{productId}: formato vendible. */
export const productSchema = timestampsSchema.extend({
  format: bookFormatSchema,
  pageCount: z.number().int().positive(),
  active: z.boolean(),
  name: localizedSchema(z.string().min(1)),
});

export type Product = z.infer<typeof productSchema>;
