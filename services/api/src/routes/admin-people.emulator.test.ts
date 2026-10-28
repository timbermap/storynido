import { COLLECTIONS } from '@storynido/shared';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { initFirebaseAdmin } from '../firebase';
import { auth, createTestApp, roleChanges } from '../test-helpers';

const db = getFirestore(initFirebaseAdmin('demo-storynido-test'));
const ADMIN = 'token-admin:admin';
const ROOT = 'token-root:superadmin';

type App = Awaited<ReturnType<typeof createTestApp>>['app'];

describe('admin: clientes y usuarios del panel', () => {
  let app: App;

  beforeAll(async () => {
    app = (await createTestApp()).app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    roleChanges.length = 0;
    for (const name of [
      COLLECTIONS.users,
      COLLECTIONS.orders,
      COLLECTIONS.children,
      COLLECTIONS.books,
      COLLECTIONS.photos,
      COLLECTIONS.auditLog,
      COLLECTIONS.privacyRequests,
      COLLECTIONS.emailLog,
    ]) {
      await db.recursiveDelete(db.collection(name));
    }
    await db
      .doc('users/ana')
      .set({ email: 'ana@storynido.test', createdAt: new Date(), locale: 'es' });
    await db
      .doc('users/root')
      .set({ email: 'root@storynido.test', role: 'superadmin', createdAt: new Date() });
    await db.doc('children/c1').set({ ownerUid: 'ana', name: 'Martina', age: 5 });
    await db.doc('books/b1').set({ ownerUid: 'ana', childId: 'c1', status: 'ordered' });
    await db
      .doc('books/b2')
      .set({ ownerUid: 'ana', childId: 'c1', status: 'draft', preview: null });
    await db.doc('orders/o1').set({
      ownerUid: 'ana',
      bookId: 'b1',
      status: 'delivered',
      currency: 'MXN',
      amounts: { totalMinor: 40000 },
      items: [{ format: 'digital', quantity: 1 }],
      createdAt: new Date(),
    });
  });

  const get = (url: string, token = ADMIN) =>
    app.inject({ method: 'GET', url, headers: auth(token) });

  it('cliente: compras y cantidad de chicos, nunca sus datos', async () => {
    const list = (await get('/v1/admin/customers?q=ana@storynido.test')).json<{
      customers: { uid: string; orders: number; children: number; spentByCurrency: object }[];
    }>();
    expect(list.customers).toEqual([
      expect.objectContaining({
        uid: 'ana',
        orders: 1,
        children: 1,
        spentByCurrency: { MXN: 40000 },
      }),
    ]);
    const detail = await get('/v1/admin/customers/ana');
    expect(detail.statusCode).toBe(200);
    expect(JSON.stringify(detail.json())).not.toContain('Martina');
  });

  it('borrado a pedido: chicos, fotos y borradores; quedan la cuenta, los pedidos y la constancia', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/customers/ana/erase-child-data',
      headers: auth(ADMIN),
    });
    expect(res.json()).toEqual({ children: 1, photos: 0, books: 1, keptOrderedBooks: 1 });
    expect((await db.doc('children/c1').get()).exists).toBe(false);
    expect((await db.doc('books/b2').get()).exists).toBe(false);
    expect((await db.doc('books/b1').get()).exists).toBe(true);
    expect((await db.doc('orders/o1').get()).exists).toBe(true);
    expect((await db.doc('users/ana').get()).exists).toBe(true);
    const requests = await db.collection(COLLECTIONS.privacyRequests).get();
    expect(requests.docs[0]?.data()).toMatchObject({
      uid: 'ana',
      requestedBy: 'admin@storynido.test',
    });
    const audit = await db
      .collection(COLLECTIONS.auditLog)
      .where('action', '==', 'privacy.admin_erase')
      .get();
    expect(audit.size).toBe(1);
  });

  it('usuarios del panel: solo el superadmin; nadie se cambia a sí mismo; siempre queda un superadmin', async () => {
    const put = (body: object, token: string) =>
      app.inject({ method: 'PUT', url: '/v1/admin/staff', headers: auth(token), payload: body });
    expect((await put({ email: 'ana@storynido.test', role: 'admin' }, ADMIN)).statusCode).toBe(403);
    const ok = await put({ email: 'ana@storynido.test', role: 'admin' }, ROOT);
    expect(ok.json()).toMatchObject({ uid: 'ana', role: 'admin', isStaff: true });
    expect(roleChanges).toEqual([{ uid: 'ana', role: 'admin' }]);
    expect((await db.doc('users/ana').get()).get('role')).toBe('admin');
    const staff = (await get('/v1/admin/staff')).json<{ staff: { uid: string }[] }>();
    expect(staff.staff.map((user) => user.uid).sort()).toEqual(['ana', 'root']);

    expect((await put({ email: 'root@storynido.test', role: 'admin' }, ROOT)).json()).toMatchObject(
      {
        error: { message: /tu propio rol/ },
      },
    );
    // Otro superadmin intenta bajar al único que queda.
    expect(
      (
        await put({ email: 'root@storynido.test', role: 'customer' }, 'token-otro:superadmin')
      ).json(),
    ).toMatchObject({ error: { message: /al menos un superadmin/ } });
    const audit = await db
      .collection(COLLECTIONS.auditLog)
      .where('action', '==', 'user.set_role')
      .get();
    expect(audit.size).toBe(1);
  });
});
