import {
  aiModelSettingsFromEnv,
  createProviderRegistry,
  providerSettingsFromEnv,
} from '@storynido/providers';
import { cloudLoggingOptions } from '@storynido/shared/server';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { buildApp } from './app';
import { loadWorkerEnv } from './config';
import { generationHandlers } from './pipeline/generation';
import { simulatedHandlers } from './pipeline/handlers';
import {
  CloudTasksDispatcher,
  CloudWorkflowsOrchestrator,
  InlineDispatcher,
  LocalOrchestrator,
} from './pipeline/orchestrators';
import { Pipeline } from './pipeline/pipeline';

const env = loadWorkerEnv(process.env);

// Con FIRESTORE_EMULATOR_HOST usa el emulador.
const firebase =
  getApps()[0] ?? initializeApp({ projectId: env.GCP_PROJECT_ID || 'demo-storynido' });

// La app y los orquestadores locales llaman al pipeline recién al atender pedidos, cuando ya existe.
const current = (): Pipeline => pipeline;

const app = buildApp({
  logger: cloudLoggingOptions('worker', env.LOG_LEVEL),
  version: env.K_REVISION,
  pipeline: current,
});

const settings = providerSettingsFromEnv(process.env);
if (
  env.APP_ENV === 'production' &&
  Object.values(settings).some((id) => id === 'mock' || id === 'local')
) {
  throw new Error(`Producción no puede usar proveedores simulados: ${JSON.stringify(settings)}`);
}
const providers = createProviderRegistry({
  settings,
  mockWebhookSecret: env.MOCK_WEBHOOK_SECRET,
  gcsBuckets:
    env.BUCKET_PHOTOS && env.BUCKET_ASSETS && env.BUCKET_PDFS
      ? { photos: env.BUCKET_PHOTOS, assets: env.BUCKET_ASSETS, pdfs: env.BUCKET_PDFS }
      : undefined,
  vertexProjectId: env.GCP_PROJECT_ID || undefined,
  vertexLocation: env.VERTEX_LOCATION,
  aiModels: aiModelSettingsFromEnv(process.env),
  localStorage: {
    rootDir: env.LOCAL_STORAGE_DIR,
    publicBaseUrl: env.PUBLIC_API_URL,
    secret: env.LOCAL_STORAGE_SECRET,
  },
});

const gcp = { projectId: env.GCP_PROJECT_ID, region: env.GCP_REGION };
const cloud = env.PIPELINE_RUNNER === 'cloud';
const pipeline = new Pipeline(
  getFirestore(firebase),
  env.PIPELINE_HANDLERS === 'simulated'
    ? simulatedHandlers()
    : generationHandlers({
        db: getFirestore(firebase),
        providers,
        log: app.log,
        allowSimulated: env.APP_ENV === 'local' || env.APP_ENV === 'test',
        brandDomain: env.BRAND_DOMAIN,
      }),
  cloud
    ? new CloudWorkflowsOrchestrator({ ...gcp, workflow: env.WORKFLOW_NAME })
    : new LocalOrchestrator(current, app.log, env.LOCAL_RETRY_BASE_MS),
  cloud
    ? new CloudTasksDispatcher({
        ...gcp,
        queue: env.ILLUSTRATION_QUEUE,
        workerUrl: env.WORKER_URL,
        invokerEmail: env.INVOKER_SA,
      })
    : new InlineDispatcher(current, app.log, env.LOCAL_RETRY_BASE_MS),
  app.log,
);

// Cloud Run envía SIGTERM antes de apagar la instancia.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down');
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ port: env.PORT, host: '0.0.0.0' });
