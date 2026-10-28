import pino from 'pino';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { EmailNotifier } from '@storynido/emails';
import { createProviderRegistry, providerSettingsFromEnv } from '@storynido/providers';
import { getFirestore } from 'firebase-admin/firestore';

import { buildApp } from './app';
import { InMemoryCatalog } from './catalog';
import { initFirebaseAdmin } from './firebase';
import { AccountService } from './accounts/service';
import { PhotoService } from './photos/service';
import { MetricsService } from './metrics/service';
import { ProService } from './pro/service';
import { PreviewService } from './preview/service';
import { loadApiConfig } from './config';
import { RecordingConversions, type ConversionReporter } from './checkout/conversions';
import { CheckoutService } from './checkout/service';
import { FulfillmentService } from './orders/fulfillment';
import { RecordingPublisher } from './orders/events';
import {
  StaticSiteConfigSource,
  type AppCheckVerifier,
  type ApiDeps,
  type TokenVerifier,
} from './deps';
import type { AppOptions } from './app';

/**
 * Tokens de prueba: "token-<uid>" con un rol opcional ("token-ana:admin") y ":mfa" si la
 * sesión tiene segundo factor ("token-ana:admin:mfa").
 * "token-<uid>:anonymous" es una sesión anónima (sin email).
 */
export const fakeTokens: TokenVerifier = {
  verify(idToken) {
    const match = /^token-([a-z0-9]+)(?::(\w+))?(:mfa)?$/.exec(idToken);
    if (!match?.[1]) return Promise.reject(new Error('token inválido'));
    if (match[2] === 'anonymous') {
      return Promise.resolve({
        uid: match[1],
        email: null,
        claims: { firebase: { sign_in_provider: 'anonymous' } },
      });
    }
    return Promise.resolve({
      uid: match[1],
      email: `${match[1]}@storynido.test`,
      claims: {
        ...(match[2] ? { role: match[2] } : {}),
        ...(match[3] ? { firebase: { sign_in_second_factor: 'totp' } } : {}),
      },
    });
  },
};

/** Usuarios borrados por los servicios durante un test. */
export const deletedUsers: string[] = [];

export const fakeAppCheck: AppCheckVerifier = {
  verify: (token) => Promise.resolve(token === 'valid-app-check'),
};

export const auth = (token: string) => ({ authorization: `Bearer ${token}` });

/** Logger mudo para servicios construidos fuera de Fastify en los tests. */
export const silentLogger = pino({ level: 'silent' });

export async function createTestApp(
  overrides: Partial<ApiDeps> & { conversions?: ConversionReporter } = {},
  env: Record<string, string> = {},
  extend?: AppOptions['extend'],
) {
  const config = loadApiConfig({ APP_ENV: 'test', RATE_LIMIT_PER_MINUTE: '1000', ...env });
  const siteConfig = new StaticSiteConfigSource();
  const providers = createProviderRegistry({
    // Solo la configuración de proveedores (p. ej. PRINT_PROVIDERS) sale de env.
    settings: providerSettingsFromEnv(env),
    mockWebhookSecret: 'test-webhook-secret',
    localStorage: {
      rootDir: mkdtempSync(path.join(tmpdir(), 'storynido-api-test-')),
      publicBaseUrl: 'http://localhost:8080',
      secret: 'test-storage-secret',
    },
  });
  const db = getFirestore(initFirebaseAdmin('demo-storynido-test'));
  const catalog = overrides.catalog ?? new InMemoryCatalog();
  const notifier =
    overrides.notifier ??
    new EmailNotifier(db, () => (overrides.providers ?? providers).email(), {
      webUrl: 'https://storynido.test',
      apiUrl: 'https://api.storynido.test',
      linkSecret: 'test-email-link-secret',
      adminEmails: ['equipo@storynido.test'],
      adminUrl: 'https://admin.storynido.test',
    });
  const previews =
    overrides.previews ??
    new PreviewService(db, overrides.providers ?? providers, catalog, silentLogger, notifier);
  const pipelineEvents = overrides.pipelineEvents ?? new RecordingPublisher();
  const pro = overrides.pro ?? new ProService(db, catalog);
  const deps: ApiDeps = {
    config,
    version: 'test',
    tokens: fakeTokens,
    appCheck: fakeAppCheck,
    siteConfig,
    providers,
    catalog,
    // Los tests corren con los emuladores de test (with-test-emulators.sh).
    photos: new PhotoService(db, providers),
    previews,
    accounts: new AccountService(
      db,
      fakeTokens,
      {
        deleteUser: (uid) => {
          deletedUsers.push(uid);
          return Promise.resolve();
        },
      },
      overrides.providers ?? providers,
      notifier,
    ),
    pipelineEvents,
    checkout: new CheckoutService(
      db,
      overrides.providers ?? providers,
      catalog,
      previews,
      pipelineEvents,
      overrides.conversions ?? new RecordingConversions(),
      silentLogger,
      { devToolsEnabled: true, mockWebhookSecret: 'test-webhook-secret' },
      notifier,
      pro,
    ),
    fulfillment: new FulfillmentService(
      db,
      overrides.providers ?? providers,
      silentLogger,
      { devToolsEnabled: true, mockWebhookSecret: 'test-webhook-secret' },
      notifier,
    ),
    notifier,
    pro,
    // Tipo de cambio fijo en los tests (sin red).
    metrics: new MetricsService(db, () => Promise.resolve({ USD: 1, MXN: 20 })),
    db,
    ...overrides,
  };
  const app = await buildApp({ deps, extend });
  return { app, siteConfig, providers, deps };
}
