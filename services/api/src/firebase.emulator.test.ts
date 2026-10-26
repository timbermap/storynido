/**
 * Integración con los emuladores (proyecto aislado demo-storynido-test):
 * tokens reales de Firebase Auth y configuración en vivo desde Firestore.
 */
import { createProviderRegistry, providerSettingsFromEnv } from '@storynido/providers';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { FirebaseTokenVerifier, FirestoreLiveConfig, initFirebaseAdmin } from './firebase';
import { auth, createTestApp, fakeAppCheck } from './test-helpers';

const PROJECT_ID = 'demo-storynido-test';
const AUTH_EMULATOR = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!AUTH_EMULATOR) throw new Error('Corré estos tests con with-test-emulators.sh');
const firebase = initFirebaseAdmin(PROJECT_ID);
const db = getFirestore(firebase);
const adminAuth = getAuth(firebase);

/** ID token real del emulador de Auth para un usuario con los claims dados. */
async function idTokenFor(uid: string, claims: Record<string, unknown> = {}): Promise<string> {
  await adminAuth.deleteUser(uid).catch(() => undefined);
  await adminAuth.createUser({ uid, email: `${uid}@storynido.test` });
  await adminAuth.setCustomUserClaims(uid, claims);
  const customToken = await adminAuth.createCustomToken(uid);
  const res = await fetch(
    `http://${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo-api-key`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const body = (await res.json()) as { idToken?: string };
  if (!body.idToken) throw new Error(`No se obtuvo token: ${JSON.stringify(body)}`);
  return body.idToken;
}

describe('API con emuladores', () => {
  const providers = createProviderRegistry({
    settings: providerSettingsFromEnv({}),
    mockWebhookSecret: 'test-webhook-secret',
    localStorage: {
      rootDir: '/tmp/storynido-api-emulator',
      publicBaseUrl: 'http://localhost:8080',
      secret: 'test-secret',
    },
  });
  const liveConfig = new FirestoreLiveConfig(firebase, providers, pino({ level: 'silent' }));
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    await db.doc('siteConfig/global').set({ mode: 'live' });
    await db.doc('aiConfig/global').delete();
    liveConfig.start();
    ctx = await createTestApp({
      tokens: new FirebaseTokenVerifier(firebase),
      appCheck: fakeAppCheck,
      siteConfig: liveConfig,
      providers,
    });
  });

  afterAll(async () => {
    liveConfig.stop();
    await ctx.app.close();
  });

  it('verifica tokens reales de Firebase y lee el rol de los claims', async () => {
    const customer = await idTokenFor('emu-cliente');
    const admin = await idTokenFor('emu-admin', { role: 'admin' });

    const me = await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: auth(customer) });
    expect(me.json()).toEqual({
      uid: 'emu-cliente',
      email: 'emu-cliente@storynido.test',
      role: 'customer',
    });

    expect(
      (await ctx.app.inject({ method: 'GET', url: '/v1/admin/providers', headers: auth(customer) }))
        .statusCode,
    ).toBe(403);
    expect(
      (await ctx.app.inject({ method: 'GET', url: '/v1/admin/providers', headers: auth(admin) }))
        .statusCode,
    ).toBe(200);
  });

  it('rechaza tokens manipulados', async () => {
    const token = await idTokenFor('emu-otro');
    const tampered = `${token.slice(0, -4)}AAAA`;
    expect(
      (await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: auth(tampered) })).statusCode,
    ).toBe(401);
  });

  it('el modo del sitio cambia en vivo desde Firestore, sin reiniciar', async () => {
    await db.doc('siteConfig/global').set({ mode: 'maintenance' });
    await vi.waitFor(() => {
      expect(liveConfig.mode()).toBe('maintenance');
    });
    const site = await ctx.app.inject({ method: 'GET', url: '/v1/site-config' });
    expect(site.json()).toEqual({ mode: 'maintenance' });

    await db.doc('siteConfig/global').set({ mode: 'live' });
    await vi.waitFor(() => {
      expect(liveConfig.mode()).toBe('live');
    });
  });

  it('la configuración de IA se aplica en vivo y rechaza proveedores no disponibles', async () => {
    await db.doc('aiConfig/global').set({ textProvider: 'mock', imageProvider: 'mock' });
    await vi.waitFor(() => {
      expect(providers.describe().active.aiText).toBe('mock');
    });
    await db.doc('aiConfig/global').set({ textProvider: 'vertex', imageProvider: 'mock' });
    // Se rechaza (todavía no existe la implementación) y se mantiene el anterior.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(providers.describe().active.aiText).toBe('mock');
  });
});
