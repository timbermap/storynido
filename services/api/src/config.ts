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
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  PUBLIC_API_URL: z.url().default('http://localhost:8080'),
  LOCAL_STORAGE_DIR: z.string().default(path.join(os.tmpdir(), 'storynido-storage')),
  /** Firmas de URLs locales y webhooks simulados: no son claves reales, solo sirven fuera de producción. */
  LOCAL_STORAGE_SECRET: z.string().min(8).default('local-dev-storage-secret'),
  MOCK_WEBHOOK_SECRET: z.string().min(8).default('local-dev-webhook-secret'),
  /** Región de Vertex AI ("global" tiene los modelos de Gemini más nuevos). */
  VERTEX_LOCATION: z.string().default('global'),
  /** Buckets reales (los define Terraform en Cloud Run). */
  BUCKET_PHOTOS: z.string().optional(),
  BUCKET_ASSETS: z.string().optional(),
  BUCKET_PDFS: z.string().optional(),
});

export type ApiEnv = z.infer<typeof apiConfigSchema>;

export interface ApiConfig {
  env: ApiEnv;
  appEnv: ApiEnv['APP_ENV'];
  projectId: string;
  corsOrigins: string[];
  appCheckEnforced: boolean;
  rateLimitPerMinute: number;
  /** Swagger UI y rutas /dev solo fuera de producción. */
  devToolsEnabled: boolean;
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
    rateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
    devToolsEnabled: env.APP_ENV !== 'production',
  };
}
