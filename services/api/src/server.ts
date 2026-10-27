import {
  aiModelSettingsFromEnv,
  createProviderRegistry,
  providerSettingsFromEnv,
} from '@storynido/providers';
import { cloudLoggingOptions } from '@storynido/shared/server';
import pino from 'pino';

import { getFirestore } from 'firebase-admin/firestore';

import { buildApp } from './app';
import { FirestoreCatalog } from './catalog';
import { AccountService } from './accounts/service';
import { PhotoService } from './photos/service';
import { PreviewService } from './preview/service';
import { CheckoutService } from './checkout/service';
import { FulfillmentService } from './orders/fulfillment';
import { ServerConversions } from './checkout/conversions';
import { loadApiConfig } from './config';
import { PubSubPublisher, WorkerHttpPublisher } from './orders/events';
import {
  FirebaseAppCheckVerifier,
  FirebaseAuthAccounts,
  FirebaseTokenVerifier,
  FirestoreLiveConfig,
  initFirebaseAdmin,
} from './firebase';

const config = loadApiConfig(process.env);
const loggerOptions = cloudLoggingOptions('api', config.env.LOG_LEVEL);
const log = pino(loggerOptions);

const settings = providerSettingsFromEnv(process.env);
if (
  config.appEnv === 'production' &&
  Object.values(settings).some((id) => id === 'mock' || id === 'local')
) {
  throw new Error(`Producción no puede usar proveedores simulados: ${JSON.stringify(settings)}`);
}

const providers = createProviderRegistry({
  settings,
  mockWebhookSecret: config.env.MOCK_WEBHOOK_SECRET,
  gcsBuckets:
    config.env.BUCKET_PHOTOS && config.env.BUCKET_ASSETS && config.env.BUCKET_PDFS
      ? {
          photos: config.env.BUCKET_PHOTOS,
          assets: config.env.BUCKET_ASSETS,
          pdfs: config.env.BUCKET_PDFS,
        }
      : undefined,
  vertexProjectId: config.env.GCP_PROJECT_ID || undefined,
  vertexLocation: config.env.VERTEX_LOCATION,
  aiModels: aiModelSettingsFromEnv(process.env),
  localStorage: {
    rootDir: config.env.LOCAL_STORAGE_DIR,
    publicBaseUrl: config.env.PUBLIC_API_URL,
    secret: config.env.LOCAL_STORAGE_SECRET,
  },
  onMockEmail: (message) => {
    log.info({ to: message.to, template: message.template, locale: message.locale }, 'mock email');
  },
});

const firebase = initFirebaseAdmin(config.projectId);
const db = getFirestore(firebase);
const liveConfig = new FirestoreLiveConfig(firebase, providers, log);
liveConfig.start();

const catalog = new FirestoreCatalog(db);
const tokens = new FirebaseTokenVerifier(firebase);

const previews = new PreviewService(db, providers, catalog, log);
const pipelineEvents =
  config.pipelineEvents === 'pubsub'
    ? new PubSubPublisher(config.projectId, config.env.ORDER_EVENTS_TOPIC)
    : new WorkerHttpPublisher(config.env.WORKER_URL);
const checkout = new CheckoutService(
  db,
  providers,
  catalog,
  previews,
  pipelineEvents,
  new ServerConversions(
    {
      ga4MeasurementId: config.env.GA4_MEASUREMENT_ID,
      ga4ApiSecret: config.env.GA4_API_SECRET,
      metaPixelId: config.env.META_PIXEL_ID,
      metaAccessToken: config.env.META_CAPI_ACCESS_TOKEN,
    },
    log,
  ),
  log,
  { devToolsEnabled: config.devToolsEnabled, mockWebhookSecret: config.env.MOCK_WEBHOOK_SECRET },
);

const app = await buildApp({
  logger: loggerOptions,
  deps: {
    config,
    version: config.env.K_REVISION,
    tokens,
    appCheck: new FirebaseAppCheckVerifier(firebase),
    siteConfig: liveConfig,
    providers,
    catalog,
    photos: new PhotoService(db, providers),
    previews,
    accounts: new AccountService(db, tokens, new FirebaseAuthAccounts(firebase)),
    pipelineEvents,
    checkout,
    fulfillment: new FulfillmentService(db, providers, log, {
      devToolsEnabled: config.devToolsEnabled,
      mockWebhookSecret: config.env.MOCK_WEBHOOK_SECRET,
    }),
    db,
  },
});

// Cloud Run envía SIGTERM antes de apagar la instancia.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down');
    liveConfig.stop();
    void app.close().then(() => process.exit(0));
  });
}

// Cloud Run no manda tráfico hasta que escucha: primero, los proveedores que eligió el admin.
await liveConfig.waitForAiConfig();
await app.listen({ port: config.env.PORT, host: '0.0.0.0' });
app.log.info(
  { providers: providers.describe().active, projectId: config.projectId, appEnv: config.appEnv },
  'api ready',
);
