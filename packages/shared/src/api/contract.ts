import { z } from 'zod';

import { countryCodeSchema } from '../countries';
import { currencySchema } from '../currency';
import { localeSchema } from '../i18n';
import { BOOK_FORMATS } from '../models/common';
import { LESSON_GROUPS } from '../models/catalog';
import { CONTENT_KEYS, SITE_MODES, aiConfigSchema } from '../models/config';
import {
  bookLengthSchema,
  contentTypeSchema,
  editorialConfigSchema,
  readingLevelSchema,
  textDensitySchema,
} from '../models/editorial';
import { PHOTO_STATUSES } from '../models/users';
import { PHOTO_RULES, photoRejectionReasonSchema } from '../providers/photo';
import { roleSchema } from '../roles';

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

export const adminAiConfigResponseSchema = z.object({
  config: aiConfigSchema.omit({ updatedAt: true, updatedBy: true }).extend({
    updatedAt: z.string().nullable(),
    updatedBy: z.string().nullable(),
  }),
  spentTodayUsd: z.number(),
  available: z.object({ text: z.array(z.string()), image: z.array(z.string()) }),
});

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
      title: z.string(),
      coverUrl: z.string(),
      pages: z.array(
        z.object({ index: z.number().int(), text: z.string(), imageUrl: z.string().nullable() }),
      ),
      totalPages: z.number().int(),
      /** El borrador cambió (historia, estilo o foto) después de generarla. */
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
});

export type PublicStory = z.infer<typeof publicStorySchema>;

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
  }),
  formats: z.array(offerFormatSchema),
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
    summary: 'Historias activas, opcionalmente filtradas por edad',
    query: localeQuerySchema.extend({ age: z.coerce.number().int().min(0).max(12).optional() }),
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
      type: z.literal('photo_upload'),
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
  regeneratePreviewIllustration: {
    method: 'POST',
    path: '/v1/books/:bookId/preview/illustrations/:target/regenerate',
    access: 'user',
    summary: 'Regenera la portada o una página ilustrada (con límite por libro)',
    params: bookParamsSchema.extend({ target: previewTargetSchema }),
    response: publicPreviewSchema,
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
