import { z } from 'zod';

import { SITE_MODES } from '../models/config';
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

export type RouteAccess = 'public' | 'user' | 'admin' | 'superadmin';

export interface ApiRoute {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Con parámetros estilo `/v1/books/:bookId`. */
  path: string;
  access: RouteAccess;
  summary: string;
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
