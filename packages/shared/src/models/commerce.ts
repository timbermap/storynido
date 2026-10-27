import { z } from 'zod';

import { countryCodeSchema } from '../countries';
import { currencySchema } from '../currency';
import { localeSchema } from '../i18n';
import { orderStatusSchema } from '../order-status';
import { avatarSchema, characterModeSchema, memoriesSchema } from './character';
import { characterTraitsSchema, mustKeepSchema } from './character';
import { channelSchema } from './channels';
import {
  bookLengthSchema,
  contentTypeSchema,
  readingLevelSchema,
  textDensitySchema,
} from './editorial';
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
  'lessonIds',
  'customLesson',
  'language',
  'dedication',
  'wizardStep',
  'photoIds',
  'characterMode',
  'avatar',
  'memories',
  'length',
  'textDensity',
  'readingLevel',
  'contentType',
  'updatedAt',
] as const;

export const bookPageSchema = z.object({
  index: z.number().int().nonnegative(),
  text: z.string(),
  /** Escena para ilustrar (en inglés). */
  illustrationPrompt: z.string(),
  /** Ilustración limpia en el bucket de assets (solo servidor; se entrega al comprar). */
  imagePath: z.string().nullable(),
  /** Versión con marca de agua que ve el cliente en la vista previa. */
  previewImagePath: z.string().nullable(),
});

export type BookPage = z.infer<typeof bookPageSchema>;

/** Páginas ilustradas en la vista previa gratis (además de la portada). */
export const PREVIEW_ILLUSTRATED_PAGES = 2;

/** Vista previa: texto completo del cuento, portada y las primeras páginas ilustradas. */
export const bookPreviewSchema = z.object({
  title: z.string(),
  /**
   * Etapa: primero se aprueba el personaje ("character"); recién después se ilustran la
   * portada y las primeras páginas ("complete"). Las muestras anteriores son "complete".
   */
  stage: z.enum(['character', 'complete']).optional(),
  /** null mientras el personaje no está aprobado. */
  cover: z.object({ imagePath: z.string(), previewImagePath: z.string() }).nullable(),
  /** Lámina del personaje con su versión de vista previa y los rasgos confirmados. */
  character: z
    .object({
      imagePath: z.string(),
      previewImagePath: z.string(),
      traits: characterTraitsSchema,
      mustKeep: mustKeepSchema,
      approvedAt: z.date().nullable(),
    })
    .optional(),
  /** Lámina del personaje (referencia interna de cada ilustración; el cliente no la ve). */
  characterImagePath: z.string().nullable().optional(),
  pages: z.array(bookPageSchema),
  /** Con qué se generó, para saber si quedó desactualizada tras editar el borrador. */
  storyId: z.string(),
  styleId: z.string(),
  /** ID de la foto usada, o la clave de los rasgos en el modo sin foto (avatarKey). */
  photoId: z.string(),
  /** Opciones editoriales con las que se generó ("extensión|densidad|nivel|tipo"). */
  editorialKey: z.string().optional(),
  /** Páginas interiores del libro terminado según esas opciones. */
  interiorPages: z.number().int().positive().optional(),
  generatedAt: z.date(),
});

export type BookPreview = z.infer<typeof bookPreviewSchema>;

/** books/{bookId}: borrador del wizard y libro generado. */
export const bookSchema = timestampsSchema
  .extend({
    ownerUid: uidSchema,
    status: bookStatusSchema,
    childId: z.string().nullable(),
    storyId: z.string().nullable(),
    styleId: z.string().nullable(),
    /** Enseñanzas elegidas (lessons), en orden de importancia. Junto con el mensaje propio, hasta CHILD_LIMITS.maxLessons. */
    lessonIds: z.array(z.string()).max(CHILD_LIMITS.maxLessons),
    /** Mensaje propio del adulto, moderado antes de usarse. */
    customLesson: z.string().trim().max(CHILD_LIMITS.customLessonMaxLength).nullable(),
    language: localeSchema,
    dedication: z.string().max(CHILD_LIMITS.dedicationMaxLength).nullable(),
    wizardStep: z.number().int().min(0).max(10),
    photoIds: z.array(z.string()).max(3),
    /** Con su foto o sin foto (rasgos elegidos). Los borradores anteriores no lo tienen: foto. */
    characterMode: characterModeSchema.default('photo'),
    /** Rasgos del modo sin foto. */
    avatar: avatarSchema.nullable().default(null),
    /** Recuerdos guiados (opcionales), moderados antes de usarse. */
    memories: memoriesSchema.nullable().default(null),
    /**
     * Opciones editoriales (fase 07b). `length` null = libro anterior: usa el pageCount de su
     * historia. Densidad, nivel y tipo tienen valores por defecto para lo anterior.
     */
    length: bookLengthSchema.nullable().default(null),
    textDensity: textDensitySchema.default('balanced'),
    readingLevel: readingLevelSchema.default('developing'),
    contentType: contentTypeSchema.default('story'),
    /** Línea comercial por la que se creó (lo anterior es de Familias). */
    channel: channelSchema.default('families'),
    /** Solo servidor. */
    preview: bookPreviewSchema.nullable(),
    /** Solo servidor. */
    regenerationsUsed: z.number().int().nonnegative(),
    /** Solo servidor: motivo legible del último intento fallido de vista previa. */
    previewError: z.string().nullable().optional(),
    /** Solo servidor: inicio de la generación en curso (para destrabar intentos colgados). */
    previewStartedAt: z.date().nullable().optional(),
    /** Solo servidor: rasgos confirmados por el adulto (sobreviven a una nueva muestra). */
    characterTraits: characterTraitsSchema.nullable().optional(),
    mustKeep: mustKeepSchema.optional(),
    /** Foto o rasgos sobre los que se confirmaron los rasgos: si cambian, dejan de valer. */
    characterBase: z.string().nullable().optional(),
    /** Solo servidor: costo de IA acumulado del libro, en millonésimas de dólar. */
    aiCostUsdMicros: z.number().int().nonnegative().optional(),
  })
  .refine(
    (book) => book.lessonIds.length + (book.customLesson ? 1 : 0) <= CHILD_LIMITS.maxLessons,
    {
      message: `Hasta ${String(CHILD_LIMITS.maxLessons)} enseñanzas (el mensaje propio cuenta como una)`,
    },
  );

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
