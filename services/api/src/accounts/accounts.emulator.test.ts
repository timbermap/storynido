/**
 * Crear sin cuenta: los datos de la sesión anónima pasan a la cuenta real al iniciar sesión
 * con un mail que ya tenía cuenta (con emuladores).
 */
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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
