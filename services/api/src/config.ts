import os from 'node:os';
import path from 'node:path';

import { serviceEnvSchema } from '@storynido/shared/server';
import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const LOCAL_ORIGINS = 'http://localhost:3000,http://localhost:3001';

export const apiConfigSchema = serviceEnvSchema.extend({
  APP_ENV: z.enum(['local', 'test', 'staging', 'production']).default('local'),
  /** Proyecto de Google Cloud / Firebase. Vacío en local: se usa el proyecto demo de los emuladores. */
  GCP_PROJECT_ID: z.string().default(''),
  /** Orígenes permitidos por CORS, separados por coma. */
  CORS_ORIGINS: z.string().optional(),
  /** Si es true, los endpoints sensibles exigen un token válido de App Check. */
  APP_CHECK_ENFORCED: booleanString.optional(),
  /** Si es true, las rutas de admin exigen sesión con segundo factor (por defecto, fuera de local). */
  ADMIN_MFA_REQUIRED: booleanString.optional(),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  PUBLIC_API_URL: z.url().default('http://localhost:8080'),
  LOCAL_STORAGE_DIR: z.string().default(path.join(os.tmpdir(), 'storynido-storage')),
  /** Firmas de URLs locales y webhooks simulados: no son claves reales, solo sirven fuera de producción. */
  LOCAL_STORAGE_SECRET: z.string().min(8).default('local-dev-storage-secret'),
  MOCK_WEBHOOK_SECRET: z.string().min(8).default('local-dev-webhook-secret'),
  /** Gelato: sin clave no se registra. Fuera de producción los pedidos quedan en borrador. */
  GELATO_API_KEY: z.string().trim().optional(),
  /** Mails: web y admin públicos (enlaces), destinatarios de alertas y firma de las bajas. */
  WEB_URL: z.url().default('http://localhost:3000'),
  ADMIN_URL: z.url().default('http://localhost:3001'),
  ADMIN_ALERT_EMAILS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean),
    ),
  EMAIL_LINK_SECRET: z.string().trim().min(16).optional(),
  /** Resend: sin clave, los mails quedan en el proveedor simulado (EMAIL_PROVIDER=mock). */
  RESEND_API_KEY: z.string().trim().optional(),
  EMAIL_FROM: z.string().default('StoryNido <hola@storynido.com>'),
  EMAIL_POSTAL_ADDRESS: z.string().optional(),
  GELATO_ORDER_TYPE: z.enum(['draft', 'order']).default('draft'),
  /** Cloudprinter: sin clave no se registra. La clave del webhook verifica sus señales. */
  CLOUDPRINTER_API_KEY: z.string().trim().optional(),
  CLOUDPRINTER_WEBHOOK_KEY: z.string().trim().optional(),
  /** Lulu: fuera de producción va al sandbox (LULU_SANDBOX lo fuerza). */
  LULU_CLIENT_KEY: z.string().trim().optional(),
  LULU_CLIENT_SECRET: z.string().trim().optional(),
  LULU_SANDBOX_CLIENT_KEY: z.string().trim().optional(),
  LULU_SANDBOX_CLIENT_SECRET: z.string().trim().optional(),
  LULU_SANDBOX: z.enum(['true', 'false']).optional(),
  /** Región de Vertex AI ("global" tiene los modelos de Gemini más nuevos). */
  VERTEX_LOCATION: z.string().default('global'),
  /** Buckets reales (los define Terraform en Cloud Run). */
  BUCKET_PHOTOS: z.string().optional(),
  BUCKET_ASSETS: z.string().optional(),
  BUCKET_PDFS: z.string().optional(),
  /** Worker del pipeline (en local, la API le manda los eventos directo). */
  WORKER_URL: z.url().default('http://localhost:8081'),
  /** "worker": eventos directo al worker (local); "pubsub": tema de Pub/Sub (nube). */
  PIPELINE_EVENTS: z.enum(['worker', 'pubsub']).optional(),
  ORDER_EVENTS_TOPIC: z.string().default('order-events'),
  /** Conversiones del lado del servidor (opcionales; sin claves no se envían). */
  GA4_MEASUREMENT_ID: z.string().optional(),
  GA4_API_SECRET: z.string().optional(),
  META_PIXEL_ID: z.string().optional(),
  META_CAPI_ACCESS_TOKEN: z.string().optional(),
});

export type ApiEnv = z.infer<typeof apiConfigSchema>;

export interface ApiConfig {
  env: ApiEnv;
  appEnv: ApiEnv['APP_ENV'];
  projectId: string;
  corsOrigins: string[];
  appCheckEnforced: boolean;
  adminMfaRequired: boolean;
  rateLimitPerMinute: number;
  /** Swagger UI y rutas /dev solo fuera de producción. */
  devToolsEnabled: boolean;
  pipelineEvents: 'worker' | 'pubsub';
}

export function loadApiConfig(source: Readonly<Record<string, string | undefined>>): ApiConfig {
  // Una variable vacía en el .env cuenta como no definida (se usa el valor por defecto).
  const defined = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const env = apiConfigSchema.parse({ ...defined, PORT: defined.PORT ?? '8080' });
  const isLocal = env.APP_ENV === 'local' || env.APP_ENV === 'test';
  const origins = env.CORS_ORIGINS ?? (isLocal ? LOCAL_ORIGINS : '');
  return {
    env,
    appEnv: env.APP_ENV,
    projectId: env.GCP_PROJECT_ID || 'demo-storynido',
    corsOrigins: origins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    appCheckEnforced: env.APP_CHECK_ENFORCED ?? env.APP_ENV === 'production',
    adminMfaRequired: env.ADMIN_MFA_REQUIRED ?? !isLocal,
    rateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
    devToolsEnabled: env.APP_ENV !== 'production',
    pipelineEvents: env.PIPELINE_EVENTS ?? (isLocal ? 'worker' : 'pubsub'),
  };
}
