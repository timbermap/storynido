import { z } from 'zod';

import { countryCodeSchema } from '../countries';
import { currencySchema } from '../currency';
import { localeSchema } from '../i18n';
import { BOOK_FORMATS } from '../models/common';
import { LESSON_GROUPS } from '../models/catalog';
import { CONTENT_KEYS, SITE_MODES } from '../models/config';
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
