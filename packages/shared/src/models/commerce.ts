import { z } from 'zod';

import { bookEventSchema } from './events';

import { countryCodeSchema, countryDefaults, type CountryCode } from '../countries';
import { currencySchema } from '../currency';
import { localeSchema } from '../i18n';
import { orderStatusSchema } from '../order-status';
import { avatarSchema, characterModeSchema, memoriesSchema } from './character';
import { characterTraitsSchema, mustKeepSchema } from './character';
import { channelSchema } from './channels';
import { orderPipelineSchema } from './pipeline';
import { priceSnapshotSchema } from './pricing';
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
    // Los países anteriores al cuento grapado no lo guardan: se vende (la imprenta decide).
    booklet: z.boolean().default(true),
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

/**
 * Un país sin configuración propia: se vende todo, en su moneda o en dólares, sin impuesto
 * propio (el envío se cotiza con cada pedido). El admin lo puede pisar en Países.
 */
export function defaultCountryConfig(code: CountryCode, now = new Date()): CountryConfig {
  const defaults = countryDefaults(code);
  return {
    code,
    active: true,
    formats: { digital: true, softcover: true, hardcover: true, booklet: true },
    currency: defaults.currency,
    defaultLocale: defaults.defaultLocale,
    taxBasisPoints: 0,
    taxIncludedInPrice: false,
    shipping: { costMinor: 0, etaDaysMin: 0, etaDaysMax: 0 },
    updatedAt: now,
  };
}

/** prices/{country}_{format} */
export const priceSchema = z.object({
  country: countryCodeSchema,
  format: bookFormatSchema,
  currency: currencySchema,
  amountMinor: z.number().int().nonnegative(),
  /** Ajuste por extensión del libro (Mini más barato, Gran aventura más caro). */
  lengthAdjustmentsMinor: z.partialRecord(bookLengthSchema, z.number().int()).default({}),
  /** Precio Pro base (cuentas profesionales); sin él, el de Familias. */
  proAmountMinor: z.number().int().nonnegative().optional(),
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
  'wizardStepKey',
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
  /** Lámina del acompañante (abuela, mascota): segunda referencia de cada ilustración. */
  companion: z
    .object({ name: z.string(), look: z.string(), imagePath: z.string() })
    .nullable()
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
  /** Dirección de arte con la que se ilustró (se congela: el libro sale igual que la muestra). */
  artDirection: z.string().nullable().optional(),
  /** Páginas de actividades y rango de palabras con que se escribió (los usa el pipeline). */
  activityPages: z.number().int().nonnegative().optional(),
  words: z.object({ min: z.number().int(), max: z.number().int() }).optional(),
  /** Plan del planificador editorial: qué se ve y qué no en cada página (fase 09). */
  plan: z
    .object({
      theme: z.string(),
      arc: z.string(),
      companion: z.object({ name: z.string(), look: z.string() }).nullable().optional(),
      scenes: z.array(
        z.object({
          pageIndex: z.number().int().nonnegative(),
          sceneGoal: z.string(),
          emotionalBeat: z.string(),
          mustBeVisible: z.array(z.string()),
          notVisible: z.array(z.string()),
          continuityFacts: z.array(z.string()),
          wordBudget: z.number().int(),
          personalDetail: z.string().nullable(),
        }),
      ),
    })
    .nullable()
    .optional(),
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
    /** Paso alcanzado, por nombre (DECISIONS 113). Sin él, se traduce `wizardStep`. */
    wizardStepKey: z.string().max(20).nullable().optional(),
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
    /** Eventos (fase 12b): cumpleaños con fecha, edad que cumple y temática. */
    event: bookEventSchema.nullable().default(null),
    /**
     * Profesionales (fase 12c): objetivo general elegido de la colección (por ejemplo
     * "reconocer emociones"). Guía la historia; nunca es una intervención clínica.
     */
    goal: z.string().trim().max(80).nullable().default(null),
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

export type Address = z.infer<typeof addressSchema>;

/** Reglas de dirección por país (lo que piden las imprentas y los correos). */
const ADDRESS_RULES: Partial<
  Record<string, { postalCode: RegExp; state: RegExp; phone: boolean }>
> = {
  MX: { postalCode: /^\d{5}$/, state: /^.{2,}$/, phone: true },
  US: { postalCode: /^\d{5}(-\d{4})?$/, state: /^[A-Z]{2}$/, phone: false },
};

/** Campos de la dirección que no cumplen las reglas de su país (vacío si está bien). */
export function addressProblems(address: Address): (keyof Address)[] {
  const rules = ADDRESS_RULES[address.country];
  if (!rules) return [];
  const problems: (keyof Address)[] = [];
  if (!rules.postalCode.test(address.postalCode.trim())) problems.push('postalCode');
  if (!rules.state.test((address.state ?? '').trim().toUpperCase())) problems.push('state');
  if (rules.phone && !/^[+\d][\d\s()-]{6,}$/.test((address.phone ?? '').trim())) {
    problems.push('phone');
  }
  return problems;
}

export const ORDER_PIECES = ['book'] as const;

/** Una línea del pedido: pieza, formato y cantidad. */
export const orderItemSchema = z.object({
  piece: z.enum(ORDER_PIECES).default('book'),
  format: bookFormatSchema,
  quantity: z.number().int().min(1).max(500),
});

export type OrderItem = z.infer<typeof orderItemSchema>;

/** orders/{orderId}: solo servidor (precios, estado y costos nunca los escribe el cliente). */
export const orderSchema = timestampsSchema.extend({
  ownerUid: uidSchema,
  bookId: z.string().min(1),
  status: orderStatusSchema,
  /** Línea comercial del pedido (los pedidos anteriores son de Familias). */
  channel: channelSchema.default('families'),
  /** Líneas del pedido: todas salen de un solo diseño (Eventos imprime N copias). */
  items: z.array(orderItemSchema).min(1),
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
  /** Costos reales en millonésimas de dólar para el cálculo de margen. */
  costsUsdMicros: z.object({
    ai: z.number().int().nonnegative(),
    print: z.number().int().nonnegative(),
    shipping: z.number().int().nonnegative(),
  }),
  /** Precio congelado: componentes, descuento y su motivo, envío e impuestos. */
  priceSnapshot: priceSnapshotSchema.nullable().default(null),
  /** Lo que el comprador aprobó y pagó (huella de la vista previa; sin datos del niño). */
  approval: z
    .object({ fingerprint: z.string(), approvedAt: z.date().nullable() })
    .nullable()
    .default(null),
  /** Consentimiento de analítica al pagar (para las conversiones del lado del servidor). */
  analyticsConsent: z.boolean().default(false),
  pipeline: orderPipelineSchema.default({
    generation: 0,
    runId: null,
    startedAt: null,
    finishedAt: null,
    failedStep: null,
    error: null,
  }),
});

export type Order = z.infer<typeof orderSchema>;

/** Rutas de las imágenes de la vista previa guardadas en un libro (para borrarlas). */
export function previewPaths(preview: unknown): string[] {
  if (!preview || typeof preview !== 'object') return [];
  const value = preview as {
    character?: { imagePath?: unknown; previewImagePath?: unknown } | null;
    companion?: { imagePath?: unknown; previewImagePath?: unknown } | null;
    cover?: { imagePath?: unknown; previewImagePath?: unknown } | null;
    pages?: { imagePath?: unknown; previewImagePath?: unknown }[];
  };
  return [value.character, value.companion, value.cover, ...(value.pages ?? [])].flatMap((item) =>
    [item?.imagePath, item?.previewImagePath].filter(
      (path): path is string => typeof path === 'string',
    ),
  );
}
