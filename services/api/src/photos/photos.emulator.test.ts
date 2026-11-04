/**
 * Flujo de fotos de punta a punta con emuladores (Firestore) y storage local:
 * consentimiento → URL firmada → subida → validación → procesamiento → borrado.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  MockPhotoAnalyzer,
  ProviderRegistry,
  createProviderFactories,
  providerSettingsFromEnv,
} from '@storynido/providers';
import { GUARDIAN_CONSENT_VERSION, PHOTO_CONSENT_VERSION, ProviderError } from '@storynido/shared';
import { getFirestore } from 'firebase-admin/firestore';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initFirebaseAdmin } from '../firebase';
import { auth, createTestApp, silentLogger } from '../test-helpers';
import { PhotoService } from './service';

const db = getFirestore(initFirebaseAdmin('demo-storynido-test'));

async function jpeg(width = 1200, height = 1600): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i += 3) {
    const x = (i / 3) % width;
    const y = Math.floor(i / 3 / width);
    const v = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 160 : 100;
    pixels.fill(v, i, i + 3);
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .jpeg()
    .toBuffer();
}

function registryWith(faces?: () => []) {
  const storageRoot = mkdtempSync(path.join(tmpdir(), 'storynido-photos-'));
  const factories = createProviderFactories({
    mockWebhookSecret: 'test-secret',
    localStorage: {
      rootDir: storageRoot,
      publicBaseUrl: 'http://localhost:8080',
      secret: 'test-storage-secret',
    },
  });
  factories.photoAnalyzer = { mock: () => new MockPhotoAnalyzer(faces ? { faces } : {}) };
  return new ProviderRegistry(factories, providerSettingsFromEnv({}));
}

async function appWith(registry: ProviderRegistry) {
  return createTestApp({
    providers: registry,
    photos: new PhotoService(db, registry, silentLogger),
  });
}

type App = Awaited<ReturnType<typeof createTestApp>>['app'];

async function seedDraft(uid: string, bookId: string, channel = 'families') {
  await db.doc(`children/${bookId}-child`).set({ ownerUid: uid, name: 'Martina' });
  await db
    .doc(`books/${bookId}`)
    .set({ ownerUid: uid, status: 'draft', childId: `${bookId}-child`, photoIds: [], channel });
}

async function consent(app: App, token: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/consents',
    headers: auth(token),
    payload: { type: 'photo_upload', textVersion: PHOTO_CONSENT_VERSION, locale: 'es' },
  });
  expect(res.statusCode).toBe(200);
  return res.json<{ consentId: string }>().consentId;
}

/** Pide URL firmada, sube el archivo y lo procesa. */
async function upload(app: App, token: string, bookId: string, consentId: string, body: Buffer) {
  const created = await app.inject({
    method: 'POST',
    url: '/v1/photos',
    headers: auth(token),
    payload: { bookId, consentId, contentType: 'image/jpeg', sizeBytes: body.length },
  });
  expect(created.statusCode).toBe(200);
  const { photoId, upload: signed } = created.json<{ photoId: string; upload: { url: string } }>();
  const url = new URL(signed.url);
  const put = await app.inject({
    method: 'PUT',
    url: url.pathname + url.search,
    headers: { 'content-type': 'image/jpeg' },
    payload: body,
  });
  expect(put.statusCode).toBe(204);
  const processed = await app.inject({
    method: 'POST',
    url: `/v1/photos/${photoId}/process`,
    headers: auth(token),
  });
  return { photoId, processed };
}

describe('fotos del protagonista', () => {
  let app: App;
  let registry: ProviderRegistry;

  beforeAll(async () => {
    registry = registryWith();
    app = (await appWith(registry)).app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    for (const name of ['photos', 'books', 'children', 'consents', 'users']) {
      const docs = await db.collection(name).listDocuments();
      await Promise.all(docs.map((doc) => doc.delete()));
    }
  });

  it('registra el consentimiento con versión, IP y navegador', async () => {
    const consentId = await consent(app, 'token-ana');
    const saved = (await db.doc(`consents/${consentId}`).get()).data();
    expect(saved).toMatchObject({
      ownerUid: 'ana',
      type: 'photo_upload',
      textVersion: PHOTO_CONSENT_VERSION,
    });
    expect(saved?.ip).toBeTruthy();
    const outdated = await app.inject({
      method: 'POST',
      url: '/v1/consents',
      headers: auth('token-ana'),
      payload: { type: 'photo_upload', textVersion: 'v0', locale: 'es' },
    });
    expect(outdated.statusCode).toBe(409);
  });

  it('sin consentimiento propio no hay URL de subida', async () => {
    await seedDraft('ana', 'b1');
    const bobConsent = await consent(app, 'token-bob');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/photos',
      headers: auth('token-ana'),
      payload: { bookId: 'b1', consentId: bobConsent, contentType: 'image/jpeg', sizeBytes: 1000 },
    });
    expect(res.statusCode).toBe(403);
  });

  it('un libro de Profesionales necesita la autorización del tutor antes de subir fotos', async () => {
    await seedDraft('ana', 'b1', 'professionals');
    await db.doc('users/ana').set({ accountType: 'professional' });
    const photoConsent = await consent(app, 'token-ana');
    const ask = () =>
      app.inject({
        method: 'POST',
        url: '/v1/photos',
        headers: auth('token-ana'),
        payload: {
          bookId: 'b1',
          consentId: photoConsent,
          contentType: 'image/jpeg',
          sizeBytes: 1000,
        },
      });
    const blocked = await ask();
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json<{ error: { message: string } }>().error.message).toContain('tutor');
    const guardian = await app.inject({
      method: 'POST',
      url: '/v1/consents',
      headers: auth('token-ana'),
      payload: {
        type: 'guardian_authorization',
        textVersion: GUARDIAN_CONSENT_VERSION,
        locale: 'es',
      },
    });
    expect(guardian.statusCode).toBe(200);
    const stored = (
      await db.doc(`consents/${guardian.json<{ consentId: string }>().consentId}`).get()
    ).data();
    expect(stored).toMatchObject({
      type: 'guardian_authorization',
      textVersion: GUARDIAN_CONSENT_VERSION,
    });
    expect((await ask()).statusCode).toBe(200);
  });

  it('un profesional que hace un cuento de Familia (su hijo) no necesita esa declaración', async () => {
    await seedDraft('ana', 'b1', 'families');
    await db.doc('users/ana').set({ accountType: 'professional' });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/photos',
      headers: auth('token-ana'),
      payload: {
        bookId: 'b1',
        consentId: await consent(app, 'token-ana'),
        contentType: 'image/jpeg',
        sizeBytes: 1000,
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it('una foto buena se valida, se procesa y queda en el borrador', async () => {
    await seedDraft('ana', 'b1');
    const consentId = await consent(app, 'token-ana');
    const { photoId, processed } = await upload(app, 'token-ana', 'b1', consentId, await jpeg());

    expect(processed.json()).toMatchObject({ id: photoId, status: 'valid', rejectionReasons: [] });
    expect(processed.json<{ previewUrl: string | null }>().previewUrl).toContain(
      '/dev/storage/photos/',
    );
    expect((await db.doc('books/b1').get()).get('photoIds')).toEqual([photoId]);

    const portrait = await registry
      .storage()
      .download({ bucket: 'photos', path: `ana/b1/${photoId}/portrait.jpg` });
    const meta = await sharp(Buffer.from(portrait)).metadata();
    expect([meta.width, meta.height]).toEqual([1024, 1024]);

    const list = await app.inject({
      method: 'GET',
      url: '/v1/books/b1/photos',
      headers: auth('token-ana'),
    });
    expect(list.json<{ photos: unknown[] }>().photos).toHaveLength(1);
  });

  it('otro usuario no ve, procesa ni borra la foto', async () => {
    await seedDraft('ana', 'b1');
    const { photoId } = await upload(
      app,
      'token-ana',
      'b1',
      await consent(app, 'token-ana'),
      await jpeg(),
    );
    for (const [method, url] of [
      ['POST', `/v1/photos/${photoId}/process`],
      ['DELETE', `/v1/photos/${photoId}`],
      ['GET', '/v1/books/b1/photos'],
    ] as const) {
      expect((await app.inject({ method, url, headers: auth('token-bob') })).statusCode).toBe(404);
    }
  });

  it('acepta hasta 3 fotos por libro', async () => {
    await seedDraft('ana', 'b1');
    const consentId = await consent(app, 'token-ana');
    for (let i = 0; i < 3; i++) await upload(app, 'token-ana', 'b1', consentId, await jpeg());
    const fourth = await app.inject({
      method: 'POST',
      url: '/v1/photos',
      headers: auth('token-ana'),
      payload: { bookId: 'b1', consentId, contentType: 'image/jpeg', sizeBytes: 1000 },
    });
    expect(fourth.statusCode).toBe(409);
  });

  it('las fotos de un personaje reutilizado se listan y cuentan para el límite', async () => {
    await seedDraft('ana', 'b1');
    const consentId = await consent(app, 'token-ana');
    const first = await upload(app, 'token-ana', 'b1', consentId, await jpeg());
    const second = await upload(app, 'token-ana', 'b1', consentId, await jpeg());
    // Cuento nuevo con el mismo personaje: copia las fotos del anterior (como hace el creador).
    await seedDraft('ana', 'b2');
    await db.doc('books/b2').update({ photoIds: [first.photoId, second.photoId, 'vencida'] });

    const list = await app.inject({
      method: 'GET',
      url: '/v1/books/b2/photos',
      headers: auth('token-ana'),
    });
    const photos = list.json<{ photos: { id: string; bookId: string }[] }>().photos;
    // La vencida (ya no existe) no sale; las otras vienen con su cuento de origen.
    expect(photos.map((photo) => photo.id).sort()).toEqual([first.photoId, second.photoId].sort());
    expect(photos.every((photo) => photo.bookId === 'b1')).toBe(true);
    // La vencida también sale del libro nuevo.
    expect((await db.doc('books/b2').get()).get('photoIds')).toEqual([
      first.photoId,
      second.photoId,
    ]);

    // 2 reutilizadas + 1 propia llegan al máximo de 3: la cuarta no se acepta.
    await upload(app, 'token-ana', 'b2', consentId, await jpeg());
    const fourth = await app.inject({
      method: 'POST',
      url: '/v1/photos',
      headers: auth('token-ana'),
      payload: { bookId: 'b2', consentId, contentType: 'image/jpeg', sizeBytes: 1000 },
    });
    expect(fourth.statusCode).toBe(409);

    // Las fotos de otro usuario nunca se listan, aunque estén en photoIds.
    await seedDraft('bob', 'b3');
    await db.doc('books/b3').update({ photoIds: [first.photoId] });
    const foreign = await app.inject({
      method: 'GET',
      url: '/v1/books/b3/photos',
      headers: auth('token-bob'),
    });
    expect(foreign.json<{ photos: unknown[] }>().photos).toEqual([]);
  });

  it('una foto solo para el personaje (sin cuento) se valida y no toca ningún libro', async () => {
    await db.doc('children/solo').set({ ownerUid: 'ana', name: 'Lu', age: 4 });
    const consentId = await consent(app, 'token-ana');
    const created = await app.inject({
      method: 'POST',
      url: '/v1/photos',
      headers: auth('token-ana'),
      payload: { childId: 'solo', consentId, contentType: 'image/jpeg', sizeBytes: 1000 },
    });
    expect(created.statusCode).toBe(200);
    const { photoId, upload: signed } = created.json<{
      photoId: string;
      upload: { url: string };
    }>();
    const url = new URL(signed.url);
    const body = await jpeg();
    await app.inject({
      method: 'PUT',
      url: url.pathname + url.search,
      headers: { 'content-type': 'image/jpeg' },
      payload: body,
    });
    const processed = await app.inject({
      method: 'POST',
      url: `/v1/photos/${photoId}/process`,
      headers: auth('token-ana'),
    });
    expect(processed.json()).toMatchObject({ id: photoId, status: 'valid', bookId: null });
    expect((await db.doc(`photos/${photoId}`).get()).get('childId')).toBe('solo');
    // Un personaje ajeno no acepta fotos; tampoco sin cuento ni personaje.
    for (const payload of [
      { childId: 'solo', consentId, contentType: 'image/jpeg', sizeBytes: 1000 },
      { consentId, contentType: 'image/jpeg', sizeBytes: 1000 },
    ]) {
      const denied = await app.inject({
        method: 'POST',
        url: '/v1/photos',
        headers: auth('token-bob'),
        payload,
      });
      expect([400, 403, 404]).toContain(denied.statusCode);
    }
  });

  it('un archivo que no es una imagen se rechaza y se borra', async () => {
    await seedDraft('ana', 'b1');
    const { photoId, processed } = await upload(
      app,
      'token-ana',
      'b1',
      await consent(app, 'token-ana'),
      Buffer.from('esto no es una foto'),
    );
    expect(processed.json()).toMatchObject({
      status: 'rejected',
      rejectionReasons: ['unsupported_format'],
    });
    expect(
      await registry.storage().exists({ bucket: 'photos', path: `ana/b1/${photoId}/original` }),
    ).toBe(false);
  });

  it('el borrado elimina archivos, metadatos y la referencia del libro', async () => {
    await seedDraft('ana', 'b1');
    const { photoId } = await upload(
      app,
      'token-ana',
      'b1',
      await consent(app, 'token-ana'),
      await jpeg(),
    );
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/photos/${photoId}`,
      headers: auth('token-ana'),
    });
    expect(res.json()).toEqual({ deleted: true });
    expect((await db.doc(`photos/${photoId}`).get()).exists).toBe(false);
    expect((await db.doc('books/b1').get()).get('photoIds')).toEqual([]);
    for (const file of ['original', 'portrait.jpg']) {
      expect(
        await registry.storage().exists({ bucket: 'photos', path: `ana/b1/${photoId}/${file}` }),
      ).toBe(false);
    }
  });
});

describe('fotos rechazadas por el análisis', () => {
  it('sin cara: motivo claro y el original se borra en el momento', async () => {
    const registry = registryWith(() => []);
    const { app } = await appWith(registry);
    try {
      await seedDraft('ana', 'b2');
      const { photoId, processed } = await upload(
        app,
        'token-ana',
        'b2',
        await consent(app, 'token-ana'),
        await jpeg(),
      );
      expect(processed.json()).toMatchObject({
        status: 'rejected',
        rejectionReasons: ['no_face'],
        previewUrl: null,
      });
      expect(
        await registry.storage().exists({ bucket: 'photos', path: `ana/b2/${photoId}/original` }),
      ).toBe(false);
      expect((await db.doc('books/b2').get()).get('photoIds')).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it('la IA no puede leer la foto: se rechaza al subir, se borra y se pide otra', async () => {
    const registry = registryWith();
    vi.spyOn(registry.ai().text, 'describeCharacter').mockRejectedValue(
      new ProviderError('vertex', 'ficha del personaje: bloqueado por seguridad', true),
    );
    const { app } = await appWith(registry);
    try {
      await seedDraft('ana', 'b3');
      const { photoId, processed } = await upload(
        app,
        'token-ana',
        'b3',
        await consent(app, 'token-ana'),
        await jpeg(),
      );
      expect(processed.json()).toMatchObject({
        status: 'rejected',
        rejectionReasons: ['unreadable'],
        previewUrl: null,
      });
      expect(
        await registry.storage().exists({ bucket: 'photos', path: `ana/b3/${photoId}/original` }),
      ).toBe(false);
      expect((await db.doc('books/b3').get()).get('photoIds')).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it('si la IA no responde (caída), la foto no se rechaza: se lee después', async () => {
    const registry = registryWith();
    vi.spyOn(registry.ai().text, 'describeCharacter').mockRejectedValue(
      new ProviderError('vertex', 'HTTP 503'),
    );
    const { app } = await appWith(registry);
    try {
      await seedDraft('ana', 'b4');
      const { photoId, processed } = await upload(
        app,
        'token-ana',
        'b4',
        await consent(app, 'token-ana'),
        await jpeg(),
      );
      expect(processed.json()).toMatchObject({ status: 'valid', rejectionReasons: [] });
      expect((await db.doc(`photos/${photoId}`).get()).get('characterSheet')).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it('si la IA la lee, la ficha queda guardada con la foto (la muestra no la vuelve a pedir)', async () => {
    const registry = registryWith();
    const { app } = await appWith(registry);
    try {
      await seedDraft('ana', 'b5');
      const { photoId } = await upload(
        app,
        'token-ana',
        'b5',
        await consent(app, 'token-ana'),
        await jpeg(),
      );
      const saved = await db.doc(`photos/${photoId}`).get();
      expect(saved.get('characterSheet')).toBeTruthy();
      expect(saved.get('characterTraits')).toBeTruthy();
    } finally {
      await app.close();
    }
  });
});
