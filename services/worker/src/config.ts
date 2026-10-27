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
  VERTEX_LOCATION: z.string().default('global'),
  BUCKET_PHOTOS: z.string().optional(),
  BUCKET_ASSETS: z.string().optional(),
  BUCKET_PDFS: z.string().optional(),
  /** Base de la espera exponencial del orquestador local, en milisegundos. */
  LOCAL_RETRY_BASE_MS: z.coerce.number().int().nonnegative().default(2000),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function loadWorkerEnv(source: Readonly<Record<string, string | undefined>>): WorkerEnv {
  // Una variable vacía cuenta como no definida.
  const defined = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  return workerEnvSchema.parse({ ...defined, PORT: defined.PORT ?? '8081' });
}
