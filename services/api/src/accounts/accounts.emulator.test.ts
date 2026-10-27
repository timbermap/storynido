/**
 * Crear sin cuenta: los datos de la sesión anónima pasan a la cuenta real al iniciar sesión
 * con un mail que ya tenía cuenta (con emuladores).
 */
import type { ProviderRegistry } from '@storynido/providers';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initFirebaseAdmin } from '../firebase';
import { auth, createTestApp, deletedUsers } from '../test-helpers';

const db = getFirestore(initFirebaseAdmin('demo-storynido-test'));

type App = Awaited<ReturnType<typeof createTestApp>>['app'];

describe('fusión de la sesión anónima', () => {
  let app: App;

  beforeAll(async () => {
    app = (await createTestApp()).app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    for (const name of ['books', 'children', 'photos', 'consents', 'auditLog']) {
      const docs = await db.collection(name).listDocuments();
      await Promise.all(docs.map((doc) => doc.delete()));
    }
    deletedUsers.length = 0;
    await db.doc('books/anon-book').set({ ownerUid: 'anon1', status: 'draft' });
    await db.doc('children/anon-child').set({ ownerUid: 'anon1', name: 'Martina' });
    await db.doc('photos/anon-photo').set({ ownerUid: 'anon1', status: 'valid' });
    await db.doc('consents/anon-consent').set({ ownerUid: 'anon1', type: 'photo_upload' });
    await db.doc('books/otro-book').set({ ownerUid: 'otro', status: 'draft' });
  });

  const merge = (token: string, anonymousIdToken: string) =>
    app.inject({
      method: 'POST',
      url: '/v1/me/merge-anonymous',
      headers: auth(token),
      payload: { anonymousIdToken },
    });

  it('pasa borrador, protagonista, fotos y consentimientos a la cuenta y borra la sesión', async () => {
    const res = await merge('token-ana', 'token-anon1:anonymous');
    expect(res.statusCode).toBe(200);
    expect(res.json<{ moved: Record<string, number> }>().moved).toEqual({
      books: 1,
      children: 1,
      photos: 1,
      consents: 1,
    });
    for (const path of ['books/anon-book', 'children/anon-child', 'photos/anon-photo']) {
      expect((await db.doc(path).get()).get('ownerUid')).toBe('ana');
    }
    const consent = await db.doc('consents/anon-consent').get();
    expect(consent.get('ownerUid')).toBe('ana');
    expect(consent.get('transferredFromUid')).toBe('anon1');
    // Lo de otras personas no se toca.
    expect((await db.doc('books/otro-book').get()).get('ownerUid')).toBe('otro');
    expect(deletedUsers).toEqual(['anon1']);
    const audit = await db
      .collection('auditLog')
      .where('action', '==', 'account.merge_anonymous')
      .get();
    expect(audit.size).toBe(1);
  });

  it('rechaza un token que no es de una sesión anónima (no se puede robar una cuenta)', async () => {
    const res = await merge('token-ana', 'token-otro');
    expect(res.statusCode).toBe(400);
    expect((await db.doc('books/otro-book').get()).get('ownerUid')).toBe('otro');
    expect(deletedUsers).toEqual([]);
  });

  it('rechaza un token inválido y exige sesión', async () => {
    expect((await merge('token-ana', 'no-es-un-token')).statusCode).toBe(400);
    const anonymous = await app.inject({
      method: 'POST',
      url: '/v1/me/merge-anonymous',
      payload: { anonymousIdToken: 'token-anon1:anonymous' },
    });
    expect(anonymous.statusCode).toBe(401);
  });
});

describe('borrado de datos a pedido', () => {
  let app: App;
  let providers: ProviderRegistry;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    providers = created.providers;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    for (const name of ['books', 'children', 'photos', 'users', 'auditLog']) {
      await db.recursiveDelete(db.collection(name));
    }
    deletedUsers.length = 0;
    const storage = providers.storage();
    await storage.upload(
      { bucket: 'photos', path: 'ana/b1/p1/original.jpg' },
      new Uint8Array([1]),
      'image/jpeg',
    );
    await storage.upload(
      { bucket: 'assets', path: 'previews/ana/b1/cover.webp' },
      new Uint8Array([1]),
      'image/webp',
    );
    await db.doc('users/ana').set({ email: 'ana@storynido.test', locale: 'es' });
    await db.doc('children/c1').set({ ownerUid: 'ana', name: 'Martina', age: 5 });
    await db.doc('photos/p1').set({
      ownerUid: 'ana',
      childId: 'c1',
      storagePath: 'ana/b1/p1/original.jpg',
      processedPath: null,
    });
    await db.doc('books/b1').set({
      ownerUid: 'ana',
      childId: 'c1',
      status: 'preview_ready',
      preview: {
        cover: { imagePath: 'previews/ana/b1/cover.webp', previewImagePath: null },
        pages: [],
      },
    });
    await db.doc('books/b2').set({ ownerUid: 'ana', childId: 'c1', status: 'ordered' });
    await db.doc('children/otro').set({ ownerUid: 'luis', name: 'Lucas' });
  });

  it('borrar un chico: perfil, fotos y borradores; los pedidos pagados se conservan', async () => {
    const send = vi.spyOn(providers.email(), 'send');
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/me/children/c1',
      headers: auth('token-ana'),
    });
    expect(res.json()).toEqual({ photos: 1, books: 1, keptOrderedBooks: 1 });
    expect((await db.doc('children/c1').get()).exists).toBe(false);
    expect((await db.doc('photos/p1').get()).exists).toBe(false);
    expect((await db.doc('books/b1').get()).exists).toBe(false);
    expect((await db.doc('books/b2').get()).exists).toBe(true);
    expect(
      await providers.storage().exists({ bucket: 'photos', path: 'ana/b1/p1/original.jpg' }),
    ).toBe(false);
    expect(
      await providers.storage().exists({ bucket: 'assets', path: 'previews/ana/b1/cover.webp' }),
    ).toBe(false);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ana@storynido.test', template: 'data_deleted' }),
    );
    // De otra persona, no.
    const other = await app.inject({
      method: 'DELETE',
      url: '/v1/me/children/otro',
      headers: auth('token-ana'),
    });
    expect(other.statusCode).toBe(404);
    send.mockRestore();
  });

  it('borrar la cuenta: datos personales y acceso; necesita confirmación y una cuenta real', async () => {
    const anonymous = await app.inject({
      method: 'DELETE',
      url: '/v1/me',
      headers: auth('token-ana:anonymous'),
      payload: { confirm: true },
    });
    expect(anonymous.statusCode).toBe(403);
    const missing = await app.inject({
      method: 'DELETE',
      url: '/v1/me',
      headers: auth('token-ana'),
      payload: {},
    });
    expect(missing.statusCode).toBe(400);

    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/me',
      headers: auth('token-ana'),
      payload: { confirm: true },
    });
    expect(res.json()).toEqual({ deleted: true });
    expect((await db.doc('users/ana').get()).exists).toBe(false);
    expect((await db.doc('children/c1').get()).exists).toBe(false);
    expect((await db.doc('books/b2').get()).exists).toBe(true);
    expect(deletedUsers).toEqual(['ana']);
    const audit = await db
      .collection('auditLog')
      .where('action', '==', 'privacy.delete_account')
      .get();
    expect(audit.size).toBe(1);
  });
});
