import { EmailNotifier } from '@storynido/emails';
import {
  aiModelSettingsFromEnv,
  createProviderRegistry,
  luluOptionsFromEnv,
  simulatedProviders,
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
import { MetricsService } from './metrics/service';
import { ProService } from './pro/service';
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
const loggerOptions = cloudLoggingOptions('api', config.env.LOG_LEVEL, config.env.K_REVISION);
const log = pino(loggerOptions);

const settings = providerSettingsFromEnv(process.env);
if (config.appEnv === 'production' && simulatedProviders(settings).length > 0) {
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
  gelato: config.env.GELATO_API_KEY
    ? { apiKey: config.env.GELATO_API_KEY, orderType: config.env.GELATO_ORDER_TYPE }
    : undefined,
  cloudprinter: config.env.CLOUDPRINTER_API_KEY
    ? {
        apiKey: config.env.CLOUDPRINTER_API_KEY,
        webhookKey: config.env.CLOUDPRINTER_WEBHOOK_KEY ?? null,
      }
    : undefined,
  lulu: luluOptionsFromEnv(config.env),
  resend: config.env.RESEND_API_KEY
    ? {
        apiKey: config.env.RESEND_API_KEY,
        from: config.env.EMAIL_FROM,
        brand: {
          name: 'StoryNido',
          siteUrl: config.env.WEB_URL,
          postalAddress: config.env.EMAIL_POSTAL_ADDRESS ?? null,
        },
      }
    : undefined,
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

const notifier = new EmailNotifier(db, () => providers.email(), {
  webUrl: config.env.WEB_URL,
  apiUrl: config.env.PUBLIC_API_URL,
  // En local alcanza una firma fija; en la nube, sin secreto no se mandan mails de marketing.
  linkSecret:
    config.env.EMAIL_LINK_SECRET ??
    (config.appEnv === 'local' ? 'local-dev-email-link-secret' : null),
  adminEmails: config.env.ADMIN_ALERT_EMAILS,
  adminUrl: config.env.ADMIN_URL,
  log,
});
const previews = new PreviewService(db, providers, catalog, log, notifier);
const pro = new ProService(db, catalog);
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
  notifier,
  pro,
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
    accounts: new AccountService(
      db,
      tokens,
      new FirebaseAuthAccounts(firebase),
      providers,
      notifier,
    ),
    pipelineEvents,
    checkout,
    fulfillment: new FulfillmentService(
      db,
      providers,
      log,
      {
        devToolsEnabled: config.devToolsEnabled,
        mockWebhookSecret: config.env.MOCK_WEBHOOK_SECRET,
      },
      notifier,
    ),
    notifier,
    pro,
    metrics: new MetricsService(db),
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
