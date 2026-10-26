import { z } from 'zod';

import { countryCodeSchema } from '../countries';
import { currencySchema } from '../currency';
import { localeSchema } from '../i18n';
import { orderStatusSchema } from '../order-status';
import { CHILD_LIMITS } from './users';
import { bookFormatSchema, timestampsSchema, uidSchema } from './common';

/** countries/{countryCode}: configuración comercial por país (editable en el admin). */
export const countrySchema = z.object({
  code: countryCodeSchema,
  active: z.boolean(),
  formats: z.object({
    digital: z.boolean(),
    softcover: z.boolean(),
    hardcover: z.boolean(),
  }),
  currency: currencySchema,
  defaultLocale: localeSchema,
  /** Impuesto en puntos básicos (1600 = 16 %). */
  taxBasisPoints: z.number().int().min(0).max(10000),
  taxIncludedInPrice: z.boolean(),
  shipping: z.object({
    costMinor: z.number().int().nonnegative(),
    etaDaysMin: z.number().int().nonnegative(),
    etaDaysMax: z.number().int().nonnegative(),
  }),
  updatedAt: z.date(),
});

export type CountryConfig = z.infer<typeof countrySchema>;

/** prices/{country}_{format} */
export const priceSchema = z.object({
  country: countryCodeSchema,
  format: bookFormatSchema,
  currency: currencySchema,
  amountMinor: z.number().int().nonnegative(),
  active: z.boolean(),
  updatedAt: z.date(),
});

export type Price = z.infer<typeof priceSchema>;

export function priceDocId(country: string, format: string): string {
  return `${country}_${format}`;
}

/** coupons/{CODE}: solo admin; el cliente valida cupones vía API. */
export const couponSchema = timestampsSchema.extend({
  code: z.string().regex(/^[A-Z0-9_-]{3,32}$/),
  type: z.enum(['percent', 'fixed']),
  /** Porcentaje (1-100) o monto fijo en unidad mínima. */
  value: z.number().int().positive(),
  currency: currencySchema.nullable(),
  countries: z.array(countryCodeSchema),
  validFrom: z.date(),
  validUntil: z.date().nullable(),
  maxRedemptions: z.number().int().positive().nullable(),
  redemptions: z.number().int().nonnegative(),
  active: z.boolean(),
});

export type Coupon = z.infer<typeof couponSchema>;

/** promotions/{promotionId} */
export const promotionSchema = timestampsSchema.extend({
  name: z.string().min(1),
  discountPercent: z.number().int().min(1).max(100),
  countries: z.array(countryCodeSchema),
  formats: z.array(bookFormatSchema),
  startsAt: z.date(),
  endsAt: z.date(),
  active: z.boolean(),
});

export type Promotion = z.infer<typeof promotionSchema>;

export const BOOK_STATUSES = ['draft', 'preview_generating', 'preview_ready', 'ordered'] as const;

export const bookStatusSchema = z.enum(BOOK_STATUSES);

/** Campos de un libro que el cliente puede editar mientras es borrador. */
export const BOOK_CLIENT_EDITABLE_FIELDS = [
  'childId',
  'storyId',
  'styleId',
  'language',
  'dedication',
  'wizardStep',
  'photoIds',
  'updatedAt',
] as const;

export const bookPageSchema = z.object({
  index: z.number().int().nonnegative(),
  text: z.string(),
  imagePath: z.string().nullable(),
});

/** books/{bookId}: borrador del wizard y libro generado. */
export const bookSchema = timestampsSchema.extend({
  ownerUid: uidSchema,
  status: bookStatusSchema,
  childId: z.string().nullable(),
  storyId: z.string().nullable(),
  styleId: z.string().nullable(),
  language: localeSchema,
  dedication: z.string().max(CHILD_LIMITS.dedicationMaxLength).nullable(),
  wizardStep: z.number().int().min(0).max(10),
  photoIds: z.array(z.string()).max(3),
  /** Solo servidor. */
  preview: z.object({ pages: z.array(bookPageSchema) }).nullable(),
  /** Solo servidor. */
  regenerationsUsed: z.number().int().nonnegative(),
});

export type Book = z.infer<typeof bookSchema>;

const moneyBreakdownSchema = z.object({
  subtotalMinor: z.number().int().nonnegative(),
  discountMinor: z.number().int().nonnegative(),
  shippingMinor: z.number().int().nonnegative(),
  taxMinor: z.number().int().nonnegative(),
  totalMinor: z.number().int().nonnegative(),
});

export const addressSchema = z.object({
  name: z.string().min(1).max(100),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).nullable(),
  city: z.string().min(1).max(100),
  state: z.string().max(100).nullable(),
  postalCode: z.string().min(1).max(20),
  country: countryCodeSchema,
  phone: z.string().max(30).nullable(),
});

/** orders/{orderId}: solo servidor (precios, estado y costos nunca los escribe el cliente). */
export const orderSchema = timestampsSchema.extend({
  ownerUid: uidSchema,
  bookId: z.string().min(1),
  status: orderStatusSchema,
  format: bookFormatSchema,
  country: countryCodeSchema,
  currency: currencySchema,
  amounts: moneyBreakdownSchema,
  couponCode: z.string().nullable(),
  gift: z.object({ isGift: z.boolean(), message: z.string().max(500).nullable() }),
  shippingAddress: addressSchema.nullable(),
  payment: z.object({
    provider: z.string(),
    checkoutSessionId: z.string().nullable(),
    paymentId: z.string().nullable(),
  }),
  print: z
    .object({
      provider: z.string(),
      externalOrderId: z.string().nullable(),
      trackingNumber: z.string().nullable(),
      trackingUrl: z.url().nullable(),
    })
    .nullable(),
  /** Costos reales en USD (centavos) para el cálculo de margen. */
  costsUsdMinor: z.object({
    ai: z.number().int().nonnegative(),
    print: z.number().int().nonnegative(),
    shipping: z.number().int().nonnegative(),
  }),
});

export type Order = z.infer<typeof orderSchema>;

export const PIPELINE_STEPS = [
  'prepare_photo',
  'generate_story',
  'generate_illustrations',
  'quality_check',
  'layout_pdf',
  'deliver',
] as const;

/** orders/{orderId}/steps/{stepId}: historial del pipeline. Solo servidor. */
export const orderStepSchema = z.object({
  name: z.enum(PIPELINE_STEPS),
  status: z.enum(['pending', 'running', 'succeeded', 'failed', 'skipped']),
  attempts: z.number().int().nonnegative(),
  startedAt: z.date().nullable(),
  finishedAt: z.date().nullable(),
  error: z.string().nullable(),
  costUsdMinor: z.number().int().nonnegative(),
});

export type OrderStep = z.infer<typeof orderStepSchema>;
