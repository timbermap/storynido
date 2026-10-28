import os from 'node:os';
import path from 'node:path';

import { serviceEnvSchema } from '@storynido/shared/server';
import { z } from 'zod';

export const workerEnvSchema = serviceEnvSchema.extend({
  APP_ENV: z.enum(['local', 'test', 'staging', 'production']).default('local'),
  GCP_PROJECT_ID: z.string().default(''),
  GCP_REGION: z.string().default('us-central1'),
  /**
   * "local": el orquestador corre dentro del worker y las páginas se ilustran en el mismo
   * proceso. "cloud": Cloud Workflows orquesta y Cloud Tasks reparte las páginas.
   */
  PIPELINE_RUNNER: z.enum(['local', 'cloud']).default('local'),
  WORKFLOW_NAME: z.string().default('order-pipeline'),
  ILLUSTRATION_QUEUE: z.string().default('illustrations'),
  /** URL pública de este worker (destino de las tareas de Cloud Tasks). */
  WORKER_URL: z.url().default('http://localhost:8081'),
  /** Cuenta de servicio con la que Cloud Tasks firma (OIDC) las llamadas al worker. */
  INVOKER_SA: z.string().default(''),
  /** "generation": pasos reales (fase 09); "simulated": recorre el pipeline sin IA. */
  PIPELINE_HANDLERS: z.enum(['generation', 'simulated']).default('generation'),
  /** Proveedores: los mismos que la API (storage local compartido en desarrollo). */
  PUBLIC_API_URL: z.url().default('http://localhost:8080'),
  LOCAL_STORAGE_DIR: z.string().default(path.join(os.tmpdir(), 'storynido-storage')),
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
  VERTEX_LOCATION: z.string().default('global'),
  BUCKET_PHOTOS: z.string().optional(),
  BUCKET_ASSETS: z.string().optional(),
  BUCKET_PDFS: z.string().optional(),
  /** Dominio de la marca (QR de la contratapa). */
  BRAND_DOMAIN: z.string().default('storynido.com'),
  /** Base de la espera exponencial del orquestador local, en milisegundos. */
  LOCAL_RETRY_BASE_MS: z.coerce.number().int().nonnegative().default(2000),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function loadWorkerEnv(source: Readonly<Record<string, string | undefined>>): WorkerEnv {
  // Una variable vacía cuenta como no definida.
  const defined = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  return workerEnvSchema.parse({ ...defined, PORT: defined.PORT ?? '8081' });
}
