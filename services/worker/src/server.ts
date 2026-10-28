import { EmailNotifier } from '@storynido/emails';
import {
  aiModelSettingsFromEnv,
  createProviderRegistry,
  luluOptionsFromEnv,
  simulatedProviders,
  providerSettingsFromEnv,
} from '@storynido/providers';
import { cloudLoggingOptions } from '@storynido/shared/server';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { buildApp } from './app';
import { PostSaleJobs } from './jobs/post-sale';
import { PipelineWatchdog } from './jobs/watchdog';
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
  logger: cloudLoggingOptions('worker', env.LOG_LEVEL, env.K_REVISION),
  version: env.K_REVISION,
  projectId: env.GCP_PROJECT_ID || 'demo-storynido',
  pipeline: current,
  jobs: () => jobs,
  watchdog: () => watchdog,
});

const settings = providerSettingsFromEnv(process.env);
if (env.APP_ENV === 'production' && simulatedProviders(settings).length > 0) {
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
  gelato: env.GELATO_API_KEY
    ? { apiKey: env.GELATO_API_KEY, orderType: env.GELATO_ORDER_TYPE }
    : undefined,
  cloudprinter: env.CLOUDPRINTER_API_KEY
    ? {
        apiKey: env.CLOUDPRINTER_API_KEY,
        webhookKey: env.CLOUDPRINTER_WEBHOOK_KEY ?? null,
      }
    : undefined,
  lulu: luluOptionsFromEnv(env),
  resend: env.RESEND_API_KEY
    ? {
        apiKey: env.RESEND_API_KEY,
        from: env.EMAIL_FROM,
        brand: {
          name: 'StoryNido',
          siteUrl: env.WEB_URL,
          postalAddress: env.EMAIL_POSTAL_ADDRESS ?? null,
        },
      }
    : undefined,
  aiModels: aiModelSettingsFromEnv(process.env),
  localStorage: {
    rootDir: env.LOCAL_STORAGE_DIR,
    publicBaseUrl: env.PUBLIC_API_URL,
    secret: env.LOCAL_STORAGE_SECRET,
  },
});

const db = getFirestore(firebase);
const notifier = new EmailNotifier(db, () => providers.email(), {
  webUrl: env.WEB_URL,
  apiUrl: env.PUBLIC_API_URL,
  // En local alcanza una firma fija; en la nube, sin secreto no se mandan mails de marketing.
  linkSecret:
    env.EMAIL_LINK_SECRET ?? (env.APP_ENV === 'local' ? 'local-dev-email-link-secret' : null),
  adminEmails: env.ADMIN_ALERT_EMAILS,
  adminUrl: env.ADMIN_URL,
  log: app.log,
});
const jobs = new PostSaleJobs(db, notifier);
const watchdog = new PipelineWatchdog(
  db,
  notifier,
  app.log,
  env.GCP_PROJECT_ID || 'demo-storynido',
);

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
  notifier,
);

// Cloud Run envía SIGTERM antes de apagar la instancia.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down');
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ port: env.PORT, host: '0.0.0.0' });
