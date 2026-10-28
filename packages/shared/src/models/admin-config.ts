import { z } from 'zod';

import { COLLECTIONS } from './collections';
import { countrySchema, couponSchema, priceDocId, priceSchema, promotionSchema } from './commerce';
import { eventPricingSchema } from './kit';
import { proDiscountConfigSchema } from './pricing';

/**
 * Configuración del negocio editable desde el admin (fase 14, etapa 2). Cada tipo dice en qué
 * colección vive, con qué esquema entra (las fechas llegan como texto ISO) y cuál es el id del
 * documento. Las fechas de auditoría (`createdAt`, `updatedAt`) y los contadores los pone el
 * servidor.
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
    input: couponSchema
      .omit({ createdAt: true, updatedAt: true, redemptions: true })
      .extend({ validFrom: z.coerce.date(), validUntil: z.coerce.date().nullable() }),
    docId: (data: { code: string }) => data.code,
  },
  promotions: {
    collection: COLLECTIONS.promotions,
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
} as const;

export const ADMIN_CONFIG_KINDS = Object.keys(ADMIN_CONFIG) as (keyof typeof ADMIN_CONFIG)[];
export const adminConfigKindSchema = z.enum(
  ADMIN_CONFIG_KINDS as [keyof typeof ADMIN_CONFIG, ...(keyof typeof ADMIN_CONFIG)[]],
);
export type AdminConfigKind = z.infer<typeof adminConfigKindSchema>;
export type AdminConfigInput<K extends AdminConfigKind> = z.input<(typeof ADMIN_CONFIG)[K]['input']>;

/** Id de documento válido para los tipos sin clave natural (slug). */
export const adminDocIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/** El id del documento tiene que coincidir con su clave natural (o ser un slug válido). */
export function expectedDocId(kind: AdminConfigKind, data: unknown): string | null {
  const { docId } = ADMIN_CONFIG[kind];
  return docId ? (docId as (value: unknown) => string)(data) : null;
}
