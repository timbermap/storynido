import { COLLECTIONS } from '@storynido/shared';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { initFirebaseAdmin } from '../firebase';
import { auth, createTestApp } from '../test-helpers';

const db = getFirestore(initFirebaseAdmin('demo-storynido-test'));
const ADMIN = 'token-admin:admin';

type App = Awaited<ReturnType<typeof createTestApp>>['app'];

describe('admin: integraciones, cotizaciones e indicadores', () => {
  let app: App;

  beforeAll(async () => {
    app = (await createTestApp()).app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.printQuoteRequests,
      COLLECTIONS.auditLog,
      COLLECTIONS.orders,
      COLLECTIONS.books,
      COLLECTIONS.aiUsage,
    ]) {
      await db.recursiveDelete(db.collection(name));
    }
  });

  const post = (url: string, payload: object) =>
    app.inject({ method: 'POST', url, headers: auth(ADMIN), payload });

  it('prueba de conexión: imprenta (cotiza sin pedir), mails, IA, storage y pagos', async () => {
    for (const kind of ['print', 'email', 'ai', 'storage', 'payment']) {
      const res = (await post('/v1/admin/integrations/test', { kind })).json<{
        ok: boolean;
        detail: string;
      }>();
      expect(res.ok, `${kind}: ${res.detail}`).toBe(true);
    }
    const missing = (
      await post('/v1/admin/integrations/test', { kind: 'print', id: 'gelato' })
    ).json<{
      ok: boolean;
    }>();
    expect(missing.ok).toBe(false);
  });

  it('cola de cotizaciones de Eventos: cambiar el estado queda en la auditoría', async () => {
    await db.doc('printQuoteRequests/q1').set({
      email: 'ana@storynido.test',
      country: 'MX',
      pieces: ['invitation'],
      copies: 30,
      message: null,
      status: 'new',
      createdAt: new Date(),
    });
    const list = (
      await app.inject({ method: 'GET', url: '/v1/admin/quote-requests', headers: auth(ADMIN) })
    ).json<{
      requests: { id: string; status: string }[];
    }>();
    expect(list.requests).toEqual([expect.objectContaining({ id: 'q1', status: 'new' })]);
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/quote-requests/q1',
      headers: auth(ADMIN),
      payload: { status: 'contacted', note: 'Le mandé precio por mail' },
    });
    expect(res.statusCode).toBe(200);
    expect((await db.doc('printQuoteRequests/q1').get()).get('status')).toBe('contacted');
    const audit = await db
      .collection(COLLECTIONS.auditLog)
      .where('action', '==', 'quote_request.update')
      .get();
    expect(audit.size).toBe(1);
  });

  it('indicadores: calidad con numerador y denominador, imprenta y canales (sin datos del niño)', async () => {
    const at = new Date();
    for (const book of ['b1', 'b2']) {
      await db
        .doc(`books/${book}`)
        .set({ ownerUid: 'ana', length: 'classic', textDensity: 'visual' });
      await db
        .collection('aiUsage')
        .add({ kind: 'character', bookId: book, orderId: null, at, day: '2026-10-28' });
    }
    await db.collection('books/b1/qaEvents').add({ code: 'character_approved', at });
    await db.collection('books/b1/qaEvents').add({ code: 'text_edited', at });
    await db.collection('books/b1/qaEvents').add({ code: 'page_human_review', at });
    const order = (id: string, data: object) =>
      db.doc(`orders/${id}`).set({
        ownerUid: 'ana',
        bookId: 'b1',
        status: 'delivered',
        channel: 'professionals',
        country: 'US',
        currency: 'USD',
        amounts: { totalMinor: 3000 },
        items: [{ format: 'softcover', quantity: 1 }],
        print: { provider: 'lulu' },
        createdAt: at,
        ...data,
      });
    await order('o1', {});
    await order('o2', { status: 'qa_failed', pipeline: { failedStep: 'deliver' } });
    await order('o3', {});
    const report = (
      await app.inject({ method: 'GET', url: '/v1/admin/insights?days=7', headers: auth(ADMIN) })
    ).json<{
      quality: { metric: string; value: number | null }[];
      print: { provider: string; orders: number; failed: number }[];
      channels: { channel: string; orders: number; repeatCustomers: number }[];
      choices: { lengths: Record<string, number> };
    }>();
    const metric = (name: string) => report.quality.find((item) => item.metric === name)?.value;
    expect(metric('preview_character_approval_rate')).toBe(50);
    expect(metric('story_edit_rate')).toBe(100);
    expect(metric('critical_visual_issue_rate')).toBe(100);
    expect(metric('preview_final_mismatch_rate')).toBe(0);
    expect(report.print).toEqual([
      expect.objectContaining({ provider: 'lulu', orders: 3, failed: 1 }),
    ]);
    expect(report.channels).toEqual([
      // El pedido en revisión ya está pagado: cuenta como venta.
      expect.objectContaining({ channel: 'professionals', orders: 3, repeatCustomers: 1 }),
    ]);
    expect(report.choices.lengths).toEqual({ classic: 3 });
  });
});
