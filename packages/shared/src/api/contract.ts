import { PREVIEW_FEEDBACK_REASONS } from '../models/qa';
import { z } from 'zod';

import { countryCodeSchema } from '../countries';
import { currencySchema } from '../currency';
import { localeSchema } from '../i18n';

import { BOOK_FORMATS, bookFormatSchema } from '../models/common';
import { LESSON_GROUPS } from '../models/catalog';
import { characterTraitsSchema, mustKeepSchema } from '../models/character';
import { channelSchema, personalizationSchema } from '../models/channels';
import { CONTENT_KEYS, SITE_MODES, aiConfigSchema } from '../models/config';
import {
  bookLengthSchema,
  contentTypeSchema,
  editorialConfigSchema,
  readingLevelSchema,
  textDensitySchema,
} from '../models/editorial';
import { adminConfigKindSchema, adminDocIdSchema } from '../models/admin-config';
import { addressSchema } from '../models/commerce';
import { KIT_PIECES, eventPricingSchema, kitSelectionSchema } from '../models/kit';
import { accountTypeSchema, proProfileSchema } from '../models/users';
import { pipelineStepSchema } from '../models/pipeline';
import { QUOTE_ERRORS, priceSnapshotSchema } from '../models/pricing';
import { PHOTO_STATUSES } from '../models/users';
import { orderStatusSchema } from '../order-status';
import { PHOTO_RULES, photoRejectionReasonSchema } from '../providers/photo';
import { roleSchema } from '../roles';

/** Etapas del login que se cuentan (analítica propia: en el login no corre Google Analytics). */
export const LOGIN_STAGES = ['started', 'succeeded', 'failed'] as const;

/** Temas del formulario de contacto. */
export const CONTACT_TOPICS = [
  'order',
  'product',
  'events',
  'professionals',
  'privacy',
  'other',
] as const;

export const API_ERROR_CODES = [
  'bad_request',
  'validation_failed',
  'unauthorized',
  'forbidden',
  'app_check_failed',
  'not_found',
  'rate_limited',
  'maintenance',
  'unavailable_in_mode',
  /** Se alcanzó un límite (regeneraciones, vistas previas por día). */
  'limit_reached',
  /** La IA está pausada (presupuesto diario agotado o moderación fallida dos veces). */
  'ai_unavailable',
  /** Hace falta una cuenta (no alcanza la sesión anónima). */
  'account_required',
  /** El libro no se puede imprimir en este destino (formato, páginas o cantidad). */
  'print_unavailable',
  /** El admin exige sesión con verificación en dos pasos. */
  'mfa_required',
  'internal',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Formato único de error de la API. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.unknown().optional(),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  version: z.string(),
});

export const siteConfigResponseSchema = z.object({
  mode: z.enum(SITE_MODES),
});

export const meResponseSchema = z.object({
  uid: z.string(),
  email: z.string().nullable(),
  role: roleSchema,
});

export const providerSettingsSchema = z.object({
  aiText: z.string(),
  aiImage: z.string(),
  payment: z.string(),
  print: z.string(),
  email: z.string(),
  storage: z.string(),
});

export const providersResponseSchema = z.object({
  active: providerSettingsSchema,
  available: z.record(z.string(), z.array(z.string())),
});

// --- Configuración de IA (admin) -----------------------------------------------

export const aiConfigUpdateSchema = aiConfigSchema
  .omit({ updatedAt: true, updatedBy: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Nada para cambiar' });

export const adminSiteConfigResponseSchema = z.object({
  mode: z.enum(SITE_MODES),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
});

export const adminAuditEntrySchema = z.object({
  id: z.string(),
  actorEmail: z.string().nullable(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  at: z.string(),
});

export type AdminAuditEntry = z.infer<typeof adminAuditEntrySchema>;

// --- Operaciones (fase 15) ---------------------------------------------------------

export const adminOrderSummarySchema = z.object({
  id: z.string(),
  status: orderStatusSchema,
  channel: z.string(),
  country: z.string(),
  currency: z.string(),
  totalMinor: z.number(),
  formats: z.array(z.string()),
  customerEmail: z.string().nullable(),
  createdAt: z.string().nullable(),
  failedStep: z.string().nullable(),
  error: z.string().nullable(),
  printProvider: z.string().nullable(),
});

export type AdminOrderSummary = z.infer<typeof adminOrderSummarySchema>;

export const adminOrderDetailSchema = adminOrderSummarySchema.extend({
  bookId: z.string(),
  bookTitle: z.string().nullable(),
  ownerUid: z.string(),
  items: z.array(z.object({ piece: z.string(), format: z.string(), quantity: z.number() })),
  amounts: z.object({
    subtotalMinor: z.number(),
    discountMinor: z.number(),
    shippingMinor: z.number(),
    taxMinor: z.number(),
    totalMinor: z.number(),
  }),
  discount: z.object({ reason: z.string().nullable(), label: z.string().nullable() }),
  shipping: z
    .object({
      name: z.string(),
      city: z.string(),
      state: z.string().nullable(),
      postalCode: z.string(),
      country: z.string(),
    })
    .nullable(),
  payment: z.object({ provider: z.string(), paymentId: z.string().nullable() }),
  print: z
    .object({
      provider: z.string(),
      externalOrderId: z.string().nullable(),
      trackingNumber: z.string().nullable(),
      trackingUrl: z.string().nullable(),
    })
    .nullable(),
  printQuotes: z.array(
    z.object({
      provider: z.string(),
      totalCostUsdMinor: z.number().nullable(),
      error: z.string().nullable(),
    }),
  ),
  costs: z.object({
    revenueUsd: z.number(),
    taxUsd: z.number(),
    aiUsd: z.number(),
    printUsd: z.number(),
    marginUsd: z.number(),
    fxDate: z.string(),
  }),
  qa: z.array(z.object({ code: z.string(), at: z.string().nullable() })),
  /** Ilustraciones del libro (URLs de 15 minutos) para la revisión manual. */
  pages: z.array(z.object({ index: z.number(), url: z.string() })),
});

export type AdminOrderDetail = z.infer<typeof adminOrderDetailSchema>;

export const adminCustomerSchema = z.object({
  uid: z.string(),
  email: z.string().nullable(),
  createdAt: z.string().nullable(),
  accountType: z.string(),
  role: z.string(),
  orders: z.number(),
  /** Gastado por moneda (unidad mínima), solo pedidos que cuentan como venta. */
  spentByCurrency: z.record(z.string(), z.number()),
  /** Cantidad de perfiles de chicos (nunca sus datos). */
  children: z.number(),
});

const usdByKey = z.record(z.string(), z.number());

export const dayMetricsSchema = z.object({
  day: z.string(),
  final: z.boolean(),
  orders: z.number(),
  refunds: z.number(),
  revenueUsd: z.number(),
  netRevenueUsd: z.number(),
  revenueByCurrency: usdByKey,
  revenueUsdByCountry: usdByKey,
  ordersByChannel: usdByKey,
  avgTicketUsd: z.number(),
  previews: z.number(),
  conversionPct: z.number(),
  aiCostUsd: z.number(),
  printCostUsd: z.number(),
  marginUsd: z.number(),
  fxSource: z.string(),
  fxDate: z.string(),
  funnel: z.record(z.string(), z.number()).optional(),
});

const costStatsSchema = z.object({
  count: z.number(),
  avgUsd: z.number(),
  p50Usd: z.number(),
  p95Usd: z.number(),
});

export const aiCostReportSchema = z.object({
  byModel: z.array(
    z.object({ provider: z.string(), model: z.string(), calls: z.number(), totalUsd: z.number() }),
  ),
  perPreview: z.array(costStatsSchema.extend({ imageModel: z.string() })),
  perBook: z.array(costStatsSchema.extend({ imageModel: z.string() })),
});

export const adminAiConfigResponseSchema = z.object({
  config: aiConfigSchema.omit({ updatedAt: true, updatedBy: true }).extend({
    updatedAt: z.string().nullable(),
    updatedBy: z.string().nullable(),
  }),
  spentTodayUsd: z.number(),
  available: z.object({ text: z.array(z.string()), image: z.array(z.string()) }),
});

// --- Pipeline del pedido (admin) ------------------------------------------------

export const adminOrderPipelineResponseSchema = z.object({
  orderId: z.string(),
  status: orderStatusSchema,
  channel: channelSchema,
  pipeline: z.object({
    generation: z.number().int(),
    runId: z.string().nullable(),
    startedAt: z.string().nullable(),
    finishedAt: z.string().nullable(),
    failedStep: pipelineStepSchema.nullable(),
    error: z.string().nullable(),
  }),
  steps: z.array(
    z.object({
      name: pipelineStepSchema,
      status: z.string(),
      generation: z.number().int(),
      attempts: z.number().int(),
      durationMs: z.number().int().nullable(),
      error: z.string().nullable(),
      costUsdMicros: z.number().int(),
    }),
  ),
  costsUsdMicros: z.object({ ai: z.number(), print: z.number(), shipping: z.number() }),
});

export type AdminOrderPipeline = z.infer<typeof adminOrderPipelineResponseSchema>;

export const pipelineRequestResponseSchema = z.object({
  accepted: z.literal(true),
  requestId: z.string(),
});

export const devPaidOrderBodySchema = z.object({
  format: bookFormatSchema.default('digital'),
  quantity: z.number().int().min(1).max(500).default(1),
});

export const devPaidOrderResponseSchema = z.object({
  orderId: z.string(),
  requestId: z.string(),
});

// --- Checkout y pedidos ---------------------------------------------------------

const checkoutItemBodySchema = z.object({
  bookId: z.string().min(1),
  format: bookFormatSchema,
  country: countryCodeSchema,
  quantity: z.number().int().min(1).max(500).default(1),
  couponCode: z.string().trim().toUpperCase().max(32).nullable().default(null),
  /** Eventos: piezas del kit y copias (digital). Sin kit, es un libro. */
  kit: kitSelectionSchema.nullable().default(null),
});

export const checkoutQuoteBodySchema = checkoutItemBodySchema.extend({
  /** Recompra: cotizar el libro ya generado de ese pedido (sin vista previa vigente). */
  sourceOrderId: z.string().min(1).nullable().default(null),
  /** Impreso: con la dirección completa se cotiza con las imprentas (envío real). */
  shippingAddress: addressSchema.nullable().default(null),
});

export const checkoutQuoteResponseSchema = z.object({
  snapshot: priceSnapshotSchema,
  couponError: z.enum(QUOTE_ERRORS).nullable(),
  /** Formatos que este libro admite (páginas y país): el pago no ofrece los demás. */
  availableFormats: z.array(bookFormatSchema).optional(),
});

export const createCheckoutBodySchema = checkoutItemBodySchema.extend({
  shippingAddress: addressSchema.nullable().default(null),
  gift: z
    .object({ isGift: z.boolean(), message: z.string().trim().max(500).nullable() })
    .default({ isGift: false, message: null }),
  analyticsConsent: z.boolean().default(false),
});

export const createCheckoutResponseSchema = z.object({
  orderId: z.string(),
  checkoutUrl: z.string(),
});

export const publicOrderSchema = z.object({
  orderId: z.string(),
  bookId: z.string(),
  status: orderStatusSchema,
  items: z.array(z.object({ format: bookFormatSchema, quantity: z.number().int() })),
  priceSnapshot: priceSnapshotSchema.nullable(),
  createdAt: z.string(),
  /** El pago se puede simular (solo fuera de producción, con el proveedor simulado). */
  canSimulatePayment: z.boolean(),
  /** La imprenta simulada puede avanzar un paso (solo fuera de producción). */
  canSimulatePrint: z.boolean(),
  /** El PDF digital ya se puede descargar. */
  canDownload: z.boolean(),
  /** Archivos digitales que se pueden descargar (el libro, cada pieza del kit y el ZIP). */
  files: z.array(z.string()),
  /** Ya se puede opinar (digital listo o impreso entregado). */
  canReview: z.boolean(),
  review: z.object({ rating: z.number().int(), comment: z.string().nullable() }).nullable(),
  tracking: z.object({ number: z.string().nullable(), url: z.string().nullable() }).nullable(),
});

export type PublicOrder = z.infer<typeof publicOrderSchema>;

// --- Vista previa ---------------------------------------------------------------

export const PREVIEW_PAGE_TEXT_MAX = 800;

const bookParamsSchema = z.object({ bookId: z.string().min(1).max(128) });

/** "cover" o el índice de una página ilustrada ("0", "1"). */
export const previewTargetSchema = z.union([
  z.literal('cover'),
  z.coerce.number().int().min(0).max(40),
]);

export const publicPreviewSchema = z.object({
  bookId: z.string(),
  status: z.enum(['draft', 'preview_generating', 'preview_ready', 'ordered']),
  /** Motivo del último intento fallido, si lo hubo. */
  error: z.string().nullable(),
  preview: z
    .object({
      /** "character": falta aprobar el personaje; "complete": portada y páginas ilustradas. */
      stage: z.enum(['character', 'complete']),
      title: z.string(),
      coverUrl: z.string().nullable(),
      character: z
        .object({
          imageUrl: z.string(),
          traits: characterTraitsSchema,
          mustKeep: mustKeepSchema,
          approved: z.boolean(),
        })
        .nullable(),
      /** Dedicatoria tal cual irá en el libro (página fija). */
      dedication: z.string().nullable(),
      /** Todas las páginas del cuento; solo las primeras tienen ilustración en la muestra. */
      pages: z.array(
        z.object({ index: z.number().int(), text: z.string(), imageUrl: z.string().nullable() }),
      ),
      totalPages: z.number().int(),
      /** El borrador cambió (historia, estilo, personaje u opciones) después de generarla. */
      stale: z.boolean(),
      generatedAt: z.string(),
    })
    .nullable(),
  regenerationsLeft: z.number().int().nonnegative(),
});

export type PublicPreview = z.infer<typeof publicPreviewSchema>;

// --- Catálogo público -----------------------------------------------------------

export const publicStorySchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  excerpt: z.string(),
  ageMin: z.number().int(),
  ageMax: z.number().int(),
  tags: z.array(z.string()),
  pageCount: z.number().int(),
  coverImage: z.string(),
  samplePages: z.array(z.string()),
  lengths: z.array(bookLengthSchema),
  textDensities: z.array(textDensitySchema),
  readingLevels: z.array(readingLevelSchema),
  contentTypes: z.array(contentTypeSchema),
  channels: z.array(channelSchema),
  collectionIds: z.array(z.string()),
  personalization: personalizationSchema,
  /** Objetivos propios de la historia, en el idioma pedido (vacío si no tiene). */
  objectives: z.array(z.string()).optional(),
  suggestedLessons: z.array(z.string()).optional(),
});

export type PublicStory = z.infer<typeof publicStorySchema>;

export const publicCollectionSchema = z.object({
  slug: z.string(),
  channel: channelSchema,
  name: z.string(),
  description: z.string(),
  topics: z.array(z.string()),
});

export type PublicCollection = z.infer<typeof publicCollectionSchema>;

export const publicLessonSchema = z.object({
  slug: z.string(),
  group: z.enum(LESSON_GROUPS),
  name: z.string(),
  headline: z.string(),
  description: z.string(),
  ageMin: z.number().int(),
  ageMax: z.number().int(),
});

export type PublicLesson = z.infer<typeof publicLessonSchema>;

export const publicStyleSchema = z.object({
  slug: z.string(),
  name: z.string(),
  sampleImage: z.string().nullable(),
  contentTypes: z.array(contentTypeSchema),
});

export const publicCountrySchema = z.object({
  code: countryCodeSchema,
  currency: currencySchema,
  defaultLocale: localeSchema,
});

export const offerFormatSchema = z.object({
  format: z.enum(BOOK_FORMATS),
  name: z.string(),
  pageCount: z.number().int(),
  amountMinor: z.number().int().nonnegative(),
  /** Impreso: precio estimado (la impresión exacta y el envío se cotizan con la dirección). */
  estimated: z.boolean().default(false),
});

/** Lo que se puede comprar en un país: formatos, precios, envío e impuestos. */
export const offerSchema = z.object({
  country: countryCodeSchema,
  available: z.boolean(),
  currency: currencySchema,
  taxBasisPoints: z.number().int(),
  taxIncludedInPrice: z.boolean(),
  shipping: z.object({
    costMinor: z.number().int().nonnegative(),
    etaDaysMin: z.number().int().nonnegative(),
    etaDaysMax: z.number().int().nonnegative(),
    /** El envío se cotiza con la dirección de cada pedido (no hay costo fijo). */
    quoted: z.boolean().default(false),
  }),
  formats: z.array(offerFormatSchema),
  /**
   * Moneda local del país, solo como referencia (todo se cobra en dólares; DECISIONS 097):
   * unidades por dólar del día. Null si el país usa dólares o no hay cotización.
   */
  local: z
    .object({ currency: currencySchema, rate: z.number().positive() })
    .nullable()
    .default(null),
  /** El país vende impresos pero la imprenta todavía no está habilitada: solo digital. */
  printUnavailable: z.boolean().default(false),
});

export type Offer = z.infer<typeof offerSchema>;

export const publicContentSchema = z.object({
  key: z.enum(CONTENT_KEYS),
  locale: localeSchema,
  title: z.string(),
  /** Markdown. */
  body: z.string(),
  updatedAt: z.iso.datetime(),
});

export type PublicContent = z.infer<typeof publicContentSchema>;

const localeQuerySchema = z.object({ locale: localeSchema });

// --- Fotos del protagonista ------------------------------------------------------

export const publicPhotoSchema = z.object({
  id: z.string(),
  bookId: z.string(),
  status: z.enum(PHOTO_STATUSES),
  rejectionReasons: z.array(photoRejectionReasonSchema),
  /** URL firmada de corta duración de la versión procesada (solo fotos válidas). */
  previewUrl: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type PublicPhoto = z.infer<typeof publicPhotoSchema>;

export const signedUploadSchema = z.object({
  url: z.string(),
  headers: z.record(z.string(), z.string()),
  expiresAt: z.iso.datetime(),
});

export type RouteAccess = 'public' | 'user' | 'admin' | 'superadmin';

export interface ApiRoute {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Con parámetros estilo `/v1/books/:bookId`. */
  path: string;
  access: RouteAccess;
  summary: string;
  params?: z.ZodType;
  body?: z.ZodType;
  query?: z.ZodType;
  response: z.ZodType;
}

/** Contrato compartido entre la API (Fastify) y los clientes (web, admin). */
export const apiRoutes = {
  health: {
    method: 'GET',
    path: '/health',
    access: 'public',
    summary: 'Estado del servicio',
    response: healthResponseSchema,
  },
  siteConfig: {
    method: 'GET',
    path: '/v1/site-config',
    access: 'public',
    summary: 'Modo actual del sitio (en vivo, mantenimiento, solo vista previa)',
    response: siteConfigResponseSchema,
  },
  me: {
    method: 'GET',
    path: '/v1/me',
    access: 'user',
    summary: 'Usuario autenticado y su rol',
    response: meResponseSchema,
  },
  catalogStories: {
    method: 'GET',
    path: '/v1/catalog/stories',
    access: 'public',
    summary: 'Historias activas, opcionalmente filtradas por edad, línea comercial y colección',
    query: localeQuerySchema.extend({
      age: z.coerce.number().int().min(0).max(12).optional(),
      channel: channelSchema.optional(),
      collection: z.string().max(80).optional(),
    }),
    response: z.object({ stories: z.array(publicStorySchema) }),
  },
  catalogStory: {
    method: 'GET',
    path: '/v1/catalog/stories/:slug',
    access: 'public',
    summary: 'Detalle de una historia',
    params: z.object({ slug: z.string().min(1).max(80) }),
    query: localeQuerySchema,
    response: publicStorySchema,
  },
  catalogLessons: {
    method: 'GET',
    path: '/v1/catalog/lessons',
    access: 'public',
    summary: 'Enseñanzas activas (combinables con cualquier historia)',
    query: localeQuerySchema.extend({ age: z.coerce.number().int().min(0).max(12).optional() }),
    response: z.object({ lessons: z.array(publicLessonSchema) }),
  },
  catalogStyles: {
    method: 'GET',
    path: '/v1/catalog/styles',
    access: 'public',
    summary: 'Estilos de ilustración activos',
    query: localeQuerySchema,
    response: z.object({ styles: z.array(publicStyleSchema) }),
  },
  catalogCollections: {
    method: 'GET',
    path: '/v1/catalog/collections',
    access: 'public',
    summary: 'Colecciones activas, opcionalmente de una línea comercial',
    query: localeQuerySchema.extend({ channel: channelSchema.optional() }),
    response: z.object({ collections: z.array(publicCollectionSchema) }),
  },
  catalogEditorial: {
    method: 'GET',
    path: '/v1/catalog/editorial',
    access: 'public',
    summary: 'Extensiones, densidades de texto, niveles de lectura y tipos de contenido vigentes',
    response: editorialConfigSchema,
  },
  catalogCountries: {
    method: 'GET',
    path: '/v1/catalog/countries',
    access: 'public',
    summary: 'Países donde se vende',
    response: z.object({ countries: z.array(publicCountrySchema) }),
  },
  catalogOffer: {
    method: 'GET',
    path: '/v1/catalog/offer',
    access: 'public',
    summary: 'Formatos, precios, envío e impuestos de un país',
    query: localeQuerySchema.extend({ country: countryCodeSchema }),
    response: offerSchema,
  },
  catalogEventPricing: {
    method: 'GET',
    path: '/v1/catalog/event-pricing',
    access: 'public',
    summary:
      'Precio del kit de Eventos de un país (diseño y licencia por pieza); null si no se vende',
    query: z.object({ country: countryCodeSchema }),
    response: z.object({ pricing: eventPricingSchema.omit({ updatedAt: true }).nullable() }),
  },
  content: {
    method: 'GET',
    path: '/v1/content/:key',
    access: 'public',
    summary: 'Texto publicado (legales, preguntas frecuentes, banners) en un idioma',
    params: z.object({ key: z.enum(CONTENT_KEYS) }),
    query: localeQuerySchema,
    response: publicContentSchema,
  },
  createConsent: {
    method: 'POST',
    path: '/v1/consents',
    access: 'user',
    summary:
      'Registra el consentimiento del adulto responsable (con fecha, versión, IP y navegador)',
    body: z.object({
      type: z.enum(['photo_upload', 'guardian_authorization']).default('photo_upload'),
      textVersion: z.string().min(1).max(40),
      locale: localeSchema,
    }),
    response: z.object({ consentId: z.string() }),
  },
  createPhoto: {
    method: 'POST',
    path: '/v1/photos',
    access: 'user',
    summary: 'Prepara la subida de una foto y devuelve una URL firmada de corta duración',
    body: z.object({
      bookId: z.string().min(1),
      consentId: z.string().min(1),
      contentType: z.enum(PHOTO_RULES.allowedTypes),
      sizeBytes: z.number().int().positive().max(PHOTO_RULES.maxBytes),
    }),
    response: z.object({ photoId: z.string(), upload: signedUploadSchema }),
  },
  processPhoto: {
    method: 'POST',
    path: '/v1/photos/:photoId/process',
    access: 'user',
    summary: 'Valida (cara, luz, nitidez, contenido) y procesa la foto ya subida',
    params: z.object({ photoId: z.string().min(1) }),
    response: publicPhotoSchema,
  },
  bookPhotos: {
    method: 'GET',
    path: '/v1/books/:bookId/photos',
    access: 'user',
    summary: 'Fotos de un borrador con URLs de vista previa de corta duración',
    params: z.object({ bookId: z.string().min(1) }),
    response: z.object({ photos: z.array(publicPhotoSchema) }),
  },
  deletePhoto: {
    method: 'DELETE',
    path: '/v1/photos/:photoId',
    access: 'user',
    summary: 'Borra la foto de inmediato (archivo original, procesado y metadatos)',
    params: z.object({ photoId: z.string().min(1) }),
    response: z.object({ deleted: z.literal(true) }),
  },
  mergeAnonymous: {
    method: 'POST',
    path: '/v1/me/merge-anonymous',
    access: 'user',
    summary:
      'Pasa a la cuenta actual los borradores creados sin cuenta (sesión anónima) y borra esa sesión',
    body: z.object({ anonymousIdToken: z.string().min(10).max(4096) }),
    response: z.object({
      moved: z.object({
        books: z.number().int(),
        children: z.number().int(),
        photos: z.number().int(),
        consents: z.number().int(),
      }),
    }),
  },
  generatePreview: {
    method: 'POST',
    path: '/v1/books/:bookId/preview',
    access: 'user',
    summary:
      'Genera la vista previa gratis (texto, portada y dos páginas con marca de agua). Responde al terminar',
    params: bookParamsSchema,
    response: publicPreviewSchema,
  },
  bookPreview: {
    method: 'GET',
    path: '/v1/books/:bookId/preview',
    access: 'user',
    summary: 'Vista previa con URLs de imágenes de corta duración',
    params: bookParamsSchema,
    response: publicPreviewSchema,
  },
  updatePreviewPage: {
    method: 'PATCH',
    path: '/v1/books/:bookId/preview/pages/:index',
    access: 'user',
    summary: 'Edita el texto de una página (se modera antes de guardarlo)',
    params: bookParamsSchema.extend({ index: z.coerce.number().int().min(0).max(40) }),
    body: z.object({ text: z.string().trim().min(1).max(PREVIEW_PAGE_TEXT_MAX) }),
    response: publicPreviewSchema,
  },
  approveCharacter: {
    method: 'POST',
    path: '/v1/books/:bookId/preview/character/approve',
    access: 'user',
    summary:
      'El adulto aprueba al personaje ("¿Es él / es ella?") y se ilustran la portada y las primeras páginas',
    params: bookParamsSchema,
    response: publicPreviewSchema,
  },
  updateCharacter: {
    method: 'PUT',
    path: '/v1/books/:bookId/preview/character',
    access: 'user',
    summary:
      'Corrige los rasgos del personaje y los que no pueden cambiar; vuelve a dibujar la lámina (cuenta como regeneración)',
    params: bookParamsSchema,
    body: z.object({ traits: characterTraitsSchema, mustKeep: mustKeepSchema }),
    response: publicPreviewSchema,
  },
  previewFeedback: {
    method: 'POST',
    path: '/v1/books/:bookId/preview/feedback',
    access: 'user',
    summary: '"¿Qué mejorarías?" después de la muestra: uno o más motivos, sin texto libre',
    params: bookParamsSchema,
    body: z.object({ reasons: z.array(z.enum(PREVIEW_FEEDBACK_REASONS)).min(1).max(5) }),
    response: z.object({ saved: z.literal(true) }),
  },
  deleteDraft: {
    method: 'DELETE',
    path: '/v1/books/:bookId',
    access: 'user',
    summary: 'Borra un borrador sin comprar (con su muestra y sus imágenes)',
    params: bookParamsSchema,
    response: z.object({ deleted: z.literal(true) }),
  },
  regeneratePreviewIllustration: {
    method: 'POST',
    path: '/v1/books/:bookId/preview/illustrations/:target/regenerate',
    access: 'user',
    summary: 'Regenera la portada o una página ilustrada (con límite por libro)',
    params: bookParamsSchema.extend({ target: previewTargetSchema }),
    response: publicPreviewSchema,
  },
  adminSiteConfig: {
    method: 'GET',
    path: '/v1/admin/site-config',
    access: 'admin',
    summary: 'Modo del sitio con quién y cuándo lo cambió',
    response: adminSiteConfigResponseSchema,
  },
  updateSiteConfig: {
    method: 'PUT',
    path: '/v1/admin/site-config',
    access: 'admin',
    summary: 'Cambia el modo del sitio en vivo, sin redeploy (queda en auditoría)',
    body: z.object({ mode: z.enum(SITE_MODES) }),
    response: adminSiteConfigResponseSchema,
  },
  adminConfigList: {
    method: 'GET',
    path: '/v1/admin/config/:kind',
    access: 'admin',
    summary: 'Documentos de configuración del negocio (países, precios, cupones, promociones…)',
    params: z.object({ kind: adminConfigKindSchema }),
    response: z.object({
      items: z.array(z.object({ id: z.string(), data: z.record(z.string(), z.unknown()) })),
    }),
  },
  adminConfigSave: {
    method: 'PUT',
    path: '/v1/admin/config/:kind/:id',
    access: 'admin',
    summary: 'Crea o reemplaza un documento de configuración (validado y auditado)',
    params: z.object({ kind: adminConfigKindSchema, id: adminDocIdSchema }),
    body: z.record(z.string(), z.unknown()),
    response: z.object({ id: z.string(), data: z.record(z.string(), z.unknown()) }),
  },
  adminMetrics: {
    method: 'GET',
    path: '/v1/admin/metrics',
    access: 'admin',
    summary: 'Métricas por día (los cerrados precalculados, hoy en vivo) y totales del rango',
    query: z.object({ days: z.coerce.number().int().min(1).max(366).default(30) }),
    response: z.object({
      days: z.array(dayMetricsSchema),
      totals: dayMetricsSchema
        .pick({
          orders: true,
          refunds: true,
          previews: true,
          revenueUsd: true,
          netRevenueUsd: true,
          aiCostUsd: true,
          printCostUsd: true,
          marginUsd: true,
          avgTicketUsd: true,
          conversionPct: true,
          revenueUsdByCountry: true,
        })
        .extend({
          funnel: z.record(z.string(), z.number()),
          daysWithoutFunnel: z.number(),
          /** Login: `navegador_método_vía_etapa` → cantidad en el rango. */
          logins: z.record(z.string(), z.number()).default({}),
        }),
    }),
  },
  adminAiCosts: {
    method: 'GET',
    path: '/v1/admin/ai-costs',
    access: 'admin',
    summary: 'Costo real de IA por muestra y por libro (promedio, p50 y p95) y por modelo',
    query: z.object({ days: z.coerce.number().int().min(1).max(366).default(30) }),
    response: aiCostReportSchema,
  },
  adminOrders: {
    method: 'GET',
    path: '/v1/admin/orders',
    access: 'admin',
    summary: 'Pedidos con filtros (estado, país, canal, formato, fechas, cliente o número)',
    query: z.object({
      status: orderStatusSchema.optional(),
      country: z.string().max(2).optional(),
      channel: z.string().max(20).optional(),
      format: z.string().max(20).optional(),
      from: z.iso.datetime().optional(),
      to: z.iso.datetime().optional(),
      /** Número de pedido o email del cliente. */
      q: z.string().max(120).optional(),
      before: z.iso.datetime().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }),
    response: z.object({ orders: z.array(adminOrderSummarySchema) }),
  },
  adminOrderDetail: {
    method: 'GET',
    path: '/v1/admin/orders/:orderId',
    access: 'admin',
    summary: 'Detalle del pedido: montos, costos y margen, imprenta, QA e ilustraciones',
    params: z.object({ orderId: z.string() }),
    response: adminOrderDetailSchema,
  },
  adminApproveOrder: {
    method: 'POST',
    path: '/v1/admin/orders/:orderId/approve',
    access: 'admin',
    summary: 'Revisión manual: aprueba las ilustraciones y el pedido sigue a maqueta y entrega',
    params: z.object({ orderId: z.string() }),
    response: z.object({ accepted: z.literal(true), requestId: z.string() }),
  },
  adminResendEmail: {
    method: 'POST',
    path: '/v1/admin/orders/:orderId/resend-email',
    access: 'admin',
    summary: 'Vuelve a mandar el mail del estado actual del pedido (queda en auditoría)',
    params: z.object({ orderId: z.string() }),
    response: z.object({ sent: z.boolean(), detail: z.string() }),
  },
  adminReviewQueue: {
    method: 'GET',
    path: '/v1/admin/review-queue',
    access: 'admin',
    summary: 'Pedidos en revisión manual (fallaron el control de calidad o un paso)',
    response: z.object({
      orders: z.array(adminOrderSummarySchema.extend({ qaCodes: z.array(z.string()) })),
    }),
  },
  adminCustomers: {
    method: 'GET',
    path: '/v1/admin/customers',
    access: 'admin',
    summary: 'Clientes (los más recientes o uno por email), con compras y cantidad de chicos',
    query: z.object({ q: z.string().max(120).optional() }),
    response: z.object({ customers: z.array(adminCustomerSchema) }),
  },
  adminCustomerDetail: {
    method: 'GET',
    path: '/v1/admin/customers/:uid',
    access: 'admin',
    summary: 'Cliente: pedidos, nivel Pro y pedidos de borrado (sin datos de los chicos)',
    params: z.object({ uid: z.string() }),
    response: adminCustomerSchema.extend({
      ordersList: z.array(adminOrderSummarySchema),
      pro: z
        .object({
          purchases: z.number(),
          digitalPercent: z.number(),
          printPercent: z.number(),
          windowDays: z.number(),
        })
        .nullable(),
      privacyRequests: z.array(
        z.object({
          requestedBy: z.string().nullable(),
          completedAt: z.string().nullable(),
          result: z.record(z.string(), z.number()),
        }),
      ),
    }),
  },
  adminEraseCustomerData: {
    method: 'POST',
    path: '/v1/admin/customers/:uid/erase-child-data',
    access: 'admin',
    summary:
      'Borra a pedido fotos, perfiles de chicos y borradores; conserva cuenta y pedidos (constancia)',
    params: z.object({ uid: z.string() }),
    response: z.object({
      children: z.number(),
      photos: z.number(),
      books: z.number(),
      keptOrderedBooks: z.number(),
    }),
  },
  adminStaff: {
    method: 'GET',
    path: '/v1/admin/staff',
    access: 'admin',
    summary: 'Usuarios del panel (admin y superadmin)',
    response: z.object({
      staff: z.array(z.object({ uid: z.string(), email: z.string().nullable(), role: roleSchema })),
    }),
  },
  adminSetStaffRole: {
    method: 'PUT',
    path: '/v1/admin/staff',
    access: 'superadmin',
    summary: 'Alta, baja o cambio de rol de un usuario del panel (queda en auditoría)',
    body: z.object({ email: z.email(), role: roleSchema }),
    response: z.object({
      uid: z.string(),
      email: z.string().nullable(),
      role: roleSchema,
      isStaff: z.boolean(),
    }),
  },
  adminTestIntegration: {
    method: 'POST',
    path: '/v1/admin/integrations/test',
    access: 'admin',
    summary:
      'Prueba de conexión de un proveedor (imprenta: cotiza; mails: verifica la clave; IA: una moderación mínima)',
    body: z.object({
      kind: z.enum(['print', 'email', 'ai', 'storage', 'payment']),
      id: z.string().max(40).optional(),
    }),
    response: z.object({ ok: z.boolean(), detail: z.string(), ms: z.number() }),
  },
  adminQuoteRequests: {
    method: 'GET',
    path: '/v1/admin/quote-requests',
    access: 'admin',
    summary: 'Cola de "Pedir cotización" de Eventos (impresos)',
    response: z.object({
      requests: z.array(
        z.object({
          id: z.string(),
          email: z.string().nullable(),
          country: z.string(),
          pieces: z.array(z.string()),
          copies: z.number(),
          message: z.string().nullable(),
          status: z.enum(['new', 'contacted', 'closed']),
          note: z.string().nullable(),
          createdAt: z.string().nullable(),
        }),
      ),
    }),
  },
  adminUpdateQuoteRequest: {
    method: 'PUT',
    path: '/v1/admin/quote-requests/:id',
    access: 'admin',
    summary: 'Cambia el estado de una cotización (queda en auditoría)',
    params: z.object({ id: z.string() }),
    body: z.object({
      status: z.enum(['new', 'contacted', 'closed']),
      note: z.string().max(500).nullable(),
    }),
    response: z.object({ id: z.string(), status: z.string() }),
  },
  adminInsights: {
    method: 'GET',
    path: '/v1/admin/insights',
    access: 'admin',
    summary:
      'Calidad (tasas del informe §10), impresión por imprenta, formato y país, y ventas por canal',
    query: z.object({ days: z.coerce.number().int().min(1).max(366).default(30) }),
    response: z.object({
      quality: z.array(
        z.object({
          metric: z.string(),
          value: z.number().nullable(),
          numerator: z.number(),
          denominator: z.number(),
          note: z.string(),
        }),
      ),
      qaCodes: z.record(z.string(), z.number()),
      print: z.array(
        z.object({
          provider: z.string(),
          format: z.string(),
          country: z.string(),
          orders: z.number(),
          failed: z.number(),
          cancelled: z.number(),
          failureRate: z.number(),
        }),
      ),
      channels: z.array(
        z.object({
          channel: z.string(),
          orders: z.number(),
          revenueUsd: z.number(),
          avgTicketUsd: z.number(),
          repeatCustomers: z.number(),
        }),
      ),
      choices: z.object({
        formats: z.record(z.string(), z.number()),
        lengths: z.record(z.string(), z.number()),
        densities: z.record(z.string(), z.number()),
      }),
    }),
  },
  adminAuditLog: {
    method: 'GET',
    path: '/v1/admin/audit-log',
    access: 'admin',
    summary: 'Registro de auditoría, del más reciente al más antiguo',
    query: z.object({
      entity: z.string().max(60).optional(),
      /** Email de quien hizo el cambio. */
      actor: z.string().max(120).optional(),
      /** Desde esta fecha (ISO). */
      from: z.iso.datetime().optional(),
      /** Paginado: entradas anteriores a esta fecha (ISO). */
      before: z.iso.datetime().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }),
    response: z.object({ entries: z.array(adminAuditEntrySchema) }),
  },
  adminAiConfig: {
    method: 'GET',
    path: '/v1/admin/ai-config',
    access: 'admin',
    summary: 'Configuración de IA vigente, gasto de hoy y modelos disponibles',
    response: adminAiConfigResponseSchema,
  },
  updateAiConfig: {
    method: 'PATCH',
    path: '/v1/admin/ai-config',
    access: 'superadmin',
    summary:
      'Cambia proveedor, modelos, límites o presupuesto de IA (efecto inmediato, queda en auditoría)',
    body: aiConfigUpdateSchema,
    response: adminAiConfigResponseSchema,
  },
  checkoutQuote: {
    method: 'POST',
    path: '/v1/checkout/quote',
    access: 'user',
    summary:
      'Precio del pedido calculado en el servidor (formato, cantidad, cupón, envío, impuestos)',
    body: checkoutQuoteBodySchema,
    response: checkoutQuoteResponseSchema,
  },
  createCheckout: {
    method: 'POST',
    path: '/v1/checkout',
    access: 'user',
    summary:
      'Crea el pedido (precio y aprobación congelados) y la sesión de pago; devuelve la URL de pago',
    body: createCheckoutBodySchema,
    response: createCheckoutResponseSchema,
  },
  order: {
    method: 'GET',
    path: '/v1/orders/:orderId',
    access: 'user',
    summary: 'Estado de un pedido propio',
    params: z.object({ orderId: z.string().min(1) }),
    response: publicOrderSchema,
  },
  devSimulatePayment: {
    method: 'POST',
    path: '/v1/dev/orders/:orderId/simulate-payment',
    access: 'user',
    summary:
      'Solo desarrollo y staging con pagos simulados: confirma el pago como lo haría el webhook',
    params: z.object({ orderId: z.string().min(1) }),
    response: publicOrderSchema,
  },
  reorder: {
    method: 'POST',
    path: '/v1/orders/:orderId/reorder',
    access: 'user',
    summary:
      'Recompra con un clic: el mismo libro ya generado en otro formato o como regalo (sin IA)',
    params: z.object({ orderId: z.string().min(1) }),
    body: createCheckoutBodySchema.omit({ bookId: true }),
    response: createCheckoutResponseSchema,
  },
  deleteChild: {
    method: 'DELETE',
    path: '/v1/me/children/:childId',
    access: 'user',
    summary:
      'Borra el perfil de un chico, sus fotos y sus borradores (los pedidos pagados se conservan)',
    params: z.object({ childId: z.string().min(1) }),
    response: z.object({
      photos: z.number().int(),
      books: z.number().int(),
      keptOrderedBooks: z.number().int(),
    }),
  },
  proActivate: {
    method: 'POST',
    path: '/v1/me/professional',
    access: 'user',
    summary: 'Activa la cuenta Profesional (perfil mínimo; no cambia el rol)',
    body: proProfileSchema,
    response: z.object({ accountType: z.literal('professional') }),
  },
  proStatus: {
    method: 'GET',
    path: '/v1/me/professional',
    access: 'user',
    summary: 'Tipo de cuenta y descuento Pro vigente (compras elegibles y próximo escalón)',
    response: z.object({
      accountType: accountTypeSchema,
      proProfile: proProfileSchema.nullable(),
      discount: z
        .object({
          windowDays: z.number().int(),
          purchases: z.number().int(),
          digitalPercent: z.number().int(),
          printPercent: z.number().int(),
          next: z.object({ purchases: z.number().int(), percent: z.number().int() }).nullable(),
        })
        .nullable(),
    }),
  },
  deleteAccount: {
    method: 'DELETE',
    path: '/v1/me',
    access: 'user',
    summary: 'Borra la cuenta y todos sus datos personales (los pedidos pagados se conservan)',
    body: z.object({ confirm: z.literal(true) }),
    response: z.object({ deleted: z.literal(true) }),
  },
  loginEvent: {
    method: 'POST',
    path: '/v1/events/login',
    access: 'public',
    summary:
      'Cuenta un paso del login por método, vía y tipo de navegador (contadores diarios, sin datos personales)',
    body: z.object({
      stage: z.enum(LOGIN_STAGES),
      method: z.enum(['google', 'apple', 'email']),
      via: z.enum(['popup', 'redirect', 'link']),
      browser: z.enum(['embedded', 'standard']),
    }),
    response: z.object({ ok: z.literal(true) }),
  },
  contact: {
    method: 'POST',
    path: '/v1/contact',
    access: 'public',
    summary:
      'Formulario de contacto: llega al equipo por mail (Responder contesta a quien escribió) y queda guardado',
    body: z.object({
      name: z.string().trim().min(1).max(80),
      email: z.email().max(200),
      topic: z.enum(CONTACT_TOPICS),
      message: z.string().trim().min(10).max(2000),
      locale: localeSchema,
      page: z.string().max(200).nullable().default(null),
      /** Trampa para bots: un campo oculto que una persona deja vacío. */
      website: z.string().max(200).optional(),
    }),
    response: z.object({ sent: z.literal(true) }),
  },
  eventPrintQuote: {
    method: 'POST',
    path: '/v1/events/print-quote',
    access: 'user',
    summary: 'Pedido de cotización de piezas del kit impresas (llega al equipo; no promete nada)',
    body: z.object({
      bookId: z.string().min(1),
      country: countryCodeSchema,
      pieces: z.array(z.enum(KIT_PIECES)).min(1),
      copies: z.number().int().min(1).max(1000),
      message: z.string().trim().max(1000).nullable().default(null),
    }),
    response: z.object({ received: z.literal(true) }),
  },
  orderReview: {
    method: 'POST',
    path: '/v1/orders/:orderId/review',
    access: 'user',
    summary: 'Opinión sobre un pedido propio (privada: publicarla es una decisión manual)',
    params: z.object({ orderId: z.string().min(1) }),
    body: z.object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().max(1000).nullable().default(null),
    }),
    response: z.object({ saved: z.literal(true) }),
  },
  orderDownload: {
    method: 'GET',
    path: '/v1/orders/:orderId/download',
    access: 'user',
    summary:
      'URL firmada (15 minutos) para descargar el PDF digital de un pedido propio (o una pieza del kit, o el ZIP)',
    params: z.object({ orderId: z.string().min(1) }),
    query: z.object({ file: z.enum(['book', 'kit_zip', ...KIT_PIECES]).default('book') }),
    response: z.object({ url: z.string(), expiresAt: z.string() }),
  },
  devSimulatePrint: {
    method: 'POST',
    path: '/v1/dev/orders/:orderId/simulate-print',
    access: 'user',
    summary:
      'Solo desarrollo y staging: la imprenta simulada avanza un paso (producción, envío, entrega)',
    params: z.object({ orderId: z.string().min(1) }),
    response: z.object({ status: orderStatusSchema }),
  },
  adminCancelPrint: {
    method: 'POST',
    path: '/v1/admin/orders/:orderId/cancel-print',
    access: 'admin',
    summary: 'Cancela el pedido en la imprenta si todavía se puede; queda en auditoría',
    params: z.object({ orderId: z.string().min(1) }),
    response: z.object({ status: orderStatusSchema }),
  },
  adminRefundOrder: {
    method: 'POST',
    path: '/v1/admin/orders/:orderId/refund',
    access: 'admin',
    summary: 'Reembolsa un pedido pagado (total); queda en auditoría',
    params: z.object({ orderId: z.string().min(1) }),
    body: z.object({ reason: z.string().trim().min(3).max(300) }),
    response: z.object({ status: orderStatusSchema, refundId: z.string() }),
  },
  adminOrderPipeline: {
    method: 'GET',
    path: '/v1/admin/orders/:orderId/pipeline',
    access: 'admin',
    summary: 'Estado del pipeline del pedido: pasos, intentos, errores y costos',
    params: z.object({ orderId: z.string().min(1) }),
    response: adminOrderPipelineResponseSchema,
  },
  adminRetryOrderStep: {
    method: 'POST',
    path: '/v1/admin/orders/:orderId/retry',
    access: 'admin',
    summary:
      'Reintenta un pedido en revisión desde un paso (por defecto el que falló); queda en auditoría',
    params: z.object({ orderId: z.string().min(1) }),
    body: z.object({ fromStep: pipelineStepSchema.optional() }),
    response: pipelineRequestResponseSchema,
  },
  adminRegenerateOrder: {
    method: 'POST',
    path: '/v1/admin/orders/:orderId/regenerate',
    access: 'admin',
    summary: 'Regenera el libro completo (nueva generación); queda en auditoría',
    params: z.object({ orderId: z.string().min(1) }),
    response: pipelineRequestResponseSchema,
  },
  devPaidOrder: {
    method: 'POST',
    path: '/v1/dev/books/:bookId/paid-order',
    access: 'user',
    summary:
      'Solo desarrollo y staging: crea un pedido pagado del libro y dispara el pipeline (pagos simulados)',
    params: z.object({ bookId: z.string().min(1) }),
    body: devPaidOrderBodySchema,
    response: devPaidOrderResponseSchema,
  },
  adminProviders: {
    method: 'GET',
    path: '/v1/admin/providers',
    access: 'admin',
    summary: 'Proveedores activos y disponibles',
    response: providersResponseSchema,
  },
} as const satisfies Record<string, ApiRoute>;

export type ApiRoutes = typeof apiRoutes;
export type ApiRouteName = keyof ApiRoutes;
