import { z } from 'zod';

import { illustrationStyleSchema, lessonSchema, storySchema } from './catalog';
import { collectionSchema } from './channels';
import { COLLECTIONS } from './collections';
import { countrySchema, couponSchema, priceDocId, priceSchema, promotionSchema } from './commerce';
import { contentDocId, contentSchema } from './config';
import { editorialConfigSchema } from './editorial';
import { eventPricingSchema } from './kit';
import { proDiscountConfigSchema } from './pricing';

/**
 * Configuración del negocio editable desde el admin (fase 14, etapas 2 y 3). Cada tipo dice en
 * qué colección vive, con qué esquema entra (las fechas llegan como texto ISO) y cuál es el id
 * del documento. `updatedAt` lo pone siempre el servidor; `createdAt` y `updatedBy`, en los
 * tipos que los tienen; los contadores (usos de un cupón) nunca los pisa el admin.
 */
export const ADMIN_CONFIG = {
  countries: {
    collection: COLLECTIONS.countries,
    input: countrySchema.omit({ updatedAt: true }),
    docId: (data: { code: string }) => data.code,
  },
  prices: {
    collection: COLLECTIONS.prices,
    input: priceSchema.omit({ updatedAt: true }),
    docId: (data: { country: string; format: string }) => priceDocId(data.country, data.format),
  },
  coupons: {
    collection: COLLECTIONS.coupons,
    createdAt: true,
    input: couponSchema
      .omit({ createdAt: true, updatedAt: true, redemptions: true })
      .extend({ validFrom: z.coerce.date(), validUntil: z.coerce.date().nullable() }),
    docId: (data: { code: string }) => data.code,
  },
  promotions: {
    collection: COLLECTIONS.promotions,
    createdAt: true,
    input: promotionSchema
      .omit({ createdAt: true, updatedAt: true })
      .extend({ startsAt: z.coerce.date(), endsAt: z.coerce.date() })
      .refine((data) => data.endsAt > data.startsAt, {
        message: 'La promoción tiene que terminar después de empezar',
        path: ['endsAt'],
      }),
    /** Las promociones no tienen clave natural: el id lo elige el admin (slug). */
    docId: null,
  },
  eventPricing: {
    collection: COLLECTIONS.eventPricing,
    input: eventPricingSchema.omit({ updatedAt: true }),
    docId: (data: { country: string }) => data.country,
  },
  proDiscounts: {
    collection: COLLECTIONS.proDiscounts,
    input: proDiscountConfigSchema.refine(
      (data) => new Set(data.tiers.map((tier) => tier.minPurchases)).size === data.tiers.length,
      { message: 'Dos escalones con la misma cantidad de compras', path: ['tiers'] },
    ),
    docId: () => 'global',
  },
  // Etapa 3: catálogo editorial y contenido.
  stories: {
    collection: COLLECTIONS.stories,
    createdAt: true,
    input: storySchema
      .omit({ createdAt: true, updatedAt: true })
      .refine((data) => data.ageMax >= data.ageMin, {
        message: 'La edad máxima es menor que la mínima',
        path: ['ageMax'],
      }),
    docId: (data: { slug: string }) => data.slug,
  },
  styles: {
    collection: COLLECTIONS.illustrationStyles,
    createdAt: true,
    input: illustrationStyleSchema.omit({ createdAt: true, updatedAt: true }),
    docId: (data: { slug: string }) => data.slug,
  },
  lessons: {
    collection: COLLECTIONS.lessons,
    createdAt: true,
    input: lessonSchema
      .omit({ createdAt: true, updatedAt: true })
      .refine((data) => data.ageMax >= data.ageMin, {
        message: 'La edad máxima es menor que la mínima',
        path: ['ageMax'],
      }),
    docId: (data: { slug: string }) => data.slug,
  },
  collections: {
    collection: COLLECTIONS.collections,
    createdAt: true,
    input: collectionSchema.omit({ createdAt: true, updatedAt: true }),
    docId: (data: { slug: string }) => data.slug,
  },
  content: {
    collection: COLLECTIONS.content,
    updatedBy: true,
    input: contentSchema.omit({ updatedAt: true, updatedBy: true }),
    docId: (data: { key: string; locale: string }) => contentDocId(data.key, data.locale),
  },
  editorial: {
    collection: COLLECTIONS.editorialConfig,
    input: editorialConfigSchema,
    docId: () => 'global',
  },
} as const;

/** Si el tipo guarda cuándo se creó o quién lo cambió por última vez. */
export const adminConfigStamps = (kind: AdminConfigKind) => {
  const entry = ADMIN_CONFIG[kind];
  return { createdAt: 'createdAt' in entry, updatedBy: 'updatedBy' in entry };
};

export const ADMIN_CONFIG_KINDS = Object.keys(ADMIN_CONFIG) as (keyof typeof ADMIN_CONFIG)[];
export const adminConfigKindSchema = z.enum(
  ADMIN_CONFIG_KINDS as [keyof typeof ADMIN_CONFIG, ...(keyof typeof ADMIN_CONFIG)[]],
);
export type AdminConfigKind = z.infer<typeof adminConfigKindSchema>;
export type AdminConfigInput<K extends AdminConfigKind> = z.input<
  (typeof ADMIN_CONFIG)[K]['input']
>;

/** Id de documento válido para los tipos sin clave natural (slug). */
export const adminDocIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/** El id del documento tiene que coincidir con su clave natural (o ser un slug válido). */
export function expectedDocId(kind: AdminConfigKind, data: unknown): string | null {
  const { docId } = ADMIN_CONFIG[kind];
  return docId ? (docId as (value: unknown) => string)(data) : null;
}
