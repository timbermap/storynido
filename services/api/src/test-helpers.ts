import pino from 'pino';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createProviderRegistry, providerSettingsFromEnv } from '@storynido/providers';
import { getFirestore } from 'firebase-admin/firestore';

import { buildApp } from './app';
import { InMemoryCatalog } from './catalog';
import { initFirebaseAdmin } from './firebase';
import { PhotoService } from './photos/service';
import { PreviewService } from './preview/service';
import { loadApiConfig } from './config';
import {
  StaticSiteConfigSource,
  type AppCheckVerifier,
  type ApiDeps,
  type TokenVerifier,
} from './deps';
import type { AppOptions } from './app';

/** Tokens de prueba: "token-<uid>" con un rol opcional ("token-ana:admin"). */
export const fakeTokens: TokenVerifier = {
  verify(idToken) {
    const match = /^token-([a-z0-9]+)(?::(\w+))?$/.exec(idToken);
    if (!match?.[1]) return Promise.reject(new Error('token inválido'));
    return Promise.resolve({
      uid: match[1],
      email: `${match[1]}@storynido.test`,
      claims: match[2] ? { role: match[2] } : {},
    });
  },
};

export const fakeAppCheck: AppCheckVerifier = {
  verify: (token) => Promise.resolve(token === 'valid-app-check'),
};

export const auth = (token: string) => ({ authorization: `Bearer ${token}` });

/** Logger mudo para servicios construidos fuera de Fastify en los tests. */
export const silentLogger = pino({ level: 'silent' });

export async function createTestApp(
  overrides: Partial<ApiDeps> = {},
  env: Record<string, string> = {},
  extend?: AppOptions['extend'],
) {
  const config = loadApiConfig({ APP_ENV: 'test', RATE_LIMIT_PER_MINUTE: '1000', ...env });
  const siteConfig = new StaticSiteConfigSource();
  const providers = createProviderRegistry({
    settings: providerSettingsFromEnv({}),
    mockWebhookSecret: 'test-webhook-secret',
    localStorage: {
      rootDir: mkdtempSync(path.join(tmpdir(), 'storynido-api-test-')),
      publicBaseUrl: 'http://localhost:8080',
      secret: 'test-storage-secret',
    },
  });
  const db = getFirestore(initFirebaseAdmin('demo-storynido-test'));
  const catalog = overrides.catalog ?? new InMemoryCatalog();
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
    previews: new PreviewService(db, overrides.providers ?? providers, catalog, silentLogger),
    db,
    ...overrides,
  };
  const app = await buildApp({ deps, extend });
  return { app, siteConfig, providers, deps };
}
