import { createProviderRegistry, providerSettingsFromEnv } from '@storynido/providers';
import { cloudLoggingOptions } from '@storynido/shared/server';
import pino from 'pino';

import { getFirestore } from 'firebase-admin/firestore';

import { buildApp } from './app';
import { FirestoreCatalog } from './catalog';
import { PhotoService } from './photos/service';
import { loadApiConfig } from './config';
import {
  FirebaseAppCheckVerifier,
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
const liveConfig = new FirestoreLiveConfig(firebase, providers, log);
liveConfig.start();

const app = await buildApp({
  logger: loggerOptions,
  deps: {
    config,
    version: config.env.K_REVISION,
    tokens: new FirebaseTokenVerifier(firebase),
    appCheck: new FirebaseAppCheckVerifier(firebase),
    siteConfig: liveConfig,
    providers,
    catalog: new FirestoreCatalog(getFirestore(firebase)),
    photos: new PhotoService(getFirestore(firebase), providers),
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

await app.listen({ port: config.env.PORT, host: '0.0.0.0' });
app.log.info(
  { providers: providers.describe().active, projectId: config.projectId, appEnv: config.appEnv },
  'api ready',
);
