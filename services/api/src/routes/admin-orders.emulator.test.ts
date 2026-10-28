import { COLLECTIONS } from '@storynido/shared';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { initFirebaseAdmin } from '../firebase';
import { RecordingPublisher } from '../orders/events';
import { auth, createTestApp } from '../test-helpers';

const db = getFirestore(initFirebaseAdmin('demo-storynido-test'));
const ADMIN = 'token-admin:admin';

type App = Awaited<ReturnType<typeof createTestApp>>['app'];

describe('admin: operación de pedidos', () => {
  let app: App;
  const events = new RecordingPublisher();

  beforeAll(async () => {
    app = (await createTestApp({ pipelineEvents: events })).app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    events.events.length = 0;
    for (const name of [
      COLLECTIONS.orders,
      COLLECTIONS.users,
      COLLECTIONS.auditLog,
      COLLECTIONS.books,
    ]) {
      await db.recursiveDelete(db.collection(name));
    }
    await db.doc('users/ana').set({ email: 'ana@storynido.test' });
    await db.doc('users/beto').set({ email: 'beto@storynido.test' });
  });

  const order = (id: string, data: Record<string, unknown>) =>
    db.doc(`orders/${id}`).set({
      ownerUid: 'ana',
      bookId: 'b1',
      status: 'paid',
      channel: 'families',
      country: 'MX',
      currency: 'MXN',
      items: [{ piece: 'book', format: 'digital', quantity: 1 }],
      amounts: {
        subtotalMinor: 40000,
        discountMinor: 0,
        shippingMinor: 0,
        taxMinor: 5517,
        totalMinor: 40000,
      },
      payment: { provider: 'mock', paymentId: 'pay_1' },
      costsUsdMicros: { ai: 1_500_000, print: 0, shipping: 0 },
      pipeline: { generation: 1, failedStep: null, error: null },
      createdAt: new Date('2026-10-20T10:00:00Z'),
      ...data,
    });
  const get = (url: string, token = ADMIN) =>
    app.inject({ method: 'GET', url, headers: auth(token) });
  const post = (url: string, token = ADMIN) =>
    app.inject({ method: 'POST', url, headers: auth(token) });

  it('busca por estado, formato, cliente (email) o número de pedido', async () => {
    await order('o1', {});
    await order('o2', {
      status: 'shipped',
      ownerUid: 'beto',
      country: 'US',
      currency: 'USD',
      items: [{ piece: 'book', format: 'softcover', quantity: 1 }],
      createdAt: new Date('2026-10-21T10:00:00Z'),
    });
    const ids = async (query: string) =>
      (await get(`/v1/admin/orders${query}`))
        .json<{ orders: { id: string }[] }>()
        .orders.map((o) => o.id);
    expect(await ids('')).toEqual(['o2', 'o1']);
    expect(await ids('?status=shipped')).toEqual(['o2']);
    expect(await ids('?format=digital')).toEqual(['o1']);
    expect(await ids('?q=beto@storynido.test')).toEqual(['o2']);
    expect(await ids('?q=o1')).toEqual(['o1']);
    expect(await ids('?q=nadie@storynido.test')).toEqual([]);
    expect((await get('/v1/admin/orders', 'token-ana')).statusCode).toBe(403);
  });

  it('detalle con costos y margen en USD (tipo de cambio del día)', async () => {
    await order('o1', { printRouting: { provider: 'mock', totalCostUsdMinor: 0, quotes: [] } });
    const detail = (await get('/v1/admin/orders/o1')).json<{
      customerEmail: string;
      costs: { revenueUsd: number; taxUsd: number; aiUsd: number; marginUsd: number };
    }>();
    // 400 MXN a 20 por dólar = USD 20; impuesto 55,17 MXN = USD 2,76; IA USD 1,50.
    expect(detail.customerEmail).toBe('ana@storynido.test');
    expect(detail.costs).toMatchObject({
      revenueUsd: 20,
      taxUsd: 2.76,
      aiUsd: 1.5,
      marginUsd: 15.74,
    });
  });

  it('aprobar desde la cola: solo si falló el control de calidad; vuelve al pipeline y queda auditado', async () => {
    await order('o1', {
      status: 'qa_failed',
      pipeline: { generation: 2, failedStep: 'quality_check', error: 'x' },
    });
    await order('o2', {
      status: 'qa_failed',
      pipeline: { generation: 1, failedStep: 'layout_pdf', error: 'x' },
    });
    const queue = (await get('/v1/admin/review-queue')).json<{ orders: { id: string }[] }>();
    expect(queue.orders.map((o) => o.id).sort()).toEqual(['o1', 'o2']);

    expect((await post('/v1/admin/orders/o2/approve')).statusCode).toBe(409);
    const ok = await post('/v1/admin/orders/o1/approve');
    expect(ok.statusCode).toBe(200);
    expect(events.events).toMatchObject([
      { type: 'order.retry_step', fromStep: 'quality_check', orderId: 'o1' },
    ]);
    expect((await db.doc('orders/o1').get()).get('pipeline.humanApproval')).toEqual({
      generation: 2,
      by: 'admin@storynido.test',
    });
    const audit = await db
      .collection(COLLECTIONS.auditLog)
      .where('action', '==', 'order.approve')
      .get();
    expect(audit.size).toBe(1);
  });

  it('reenviar el mail del estado actual queda en la auditoría', async () => {
    await order('o1', {
      priceSnapshot: { totalMinor: 40000, currency: 'MXN' },
      bookTitle: 'La gran aventura',
    });
    const res = (await post('/v1/admin/orders/o1/resend-email')).json<{ sent: boolean }>();
    expect(res.sent).toBe(true);
    const audit = await db
      .collection(COLLECTIONS.auditLog)
      .where('action', '==', 'order.resend_email')
      .get();
    expect(audit.docs[0]?.get('after.sent')).toBe(true);
  });
});
