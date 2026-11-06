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
      COLLECTIONS.photos,
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
  const post = (url: string, bodyOrToken: string | Record<string, unknown> = ADMIN) =>
    typeof bodyOrToken === 'string'
      ? app.inject({ method: 'POST', url, headers: auth(bodyOrToken) })
      : app.inject({ method: 'POST', url, headers: auth(ADMIN), payload: bodyOrToken });

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

  it('en revisión muestra las páginas buenas y marca la que falló, aunque el paso no haya terminado', async () => {
    await order('o1', {
      status: 'qa_failed',
      pipeline: { generation: 0, failedStep: 'generate_illustrations' },
      snapshot: { title: 'Aggi', pages: [{ text: 'Hola' }, { text: 'Chau' }] },
    });
    const tasks = db.collection('orders/o1/steps/generate_illustrations/pages');
    await tasks
      .doc('1')
      .set({ index: 1, generation: 0, status: 'succeeded', imagePath: 'x/1.webp' });
    await tasks.doc('2').set({
      index: 2,
      generation: 0,
      status: 'failed',
      imagePath: null,
      error: 'La ilustración 2 no pasó la moderación.',
    });
    const detail = (await get('/v1/admin/orders/o1')).json<{
      pages: { index: number; url: string | null; error: string | null; text: string | null }[];
    }>();
    expect(detail.pages.map((page) => [page.index, page.url !== null])).toEqual([
      [1, true],
      [2, false],
    ]);
    expect(detail.pages[1]?.error).toContain('moderación');
    expect(detail.pages.map((page) => page.text)).toEqual(['Hola', 'Chau']);
  });

  it('armar el libro para revisarlo: solo en revisión o listo, publica el evento y no audita ni cambia el pedido', async () => {
    await order('o1', { status: 'qa_failed' });
    await order('o2', { status: 'paid' });
    expect((await post('/v1/admin/orders/o2/preview-book')).statusCode).toBe(409);
    const ok = await post('/v1/admin/orders/o1/preview-book');
    expect(ok.statusCode).toBe(200);
    expect(events.events.map((event) => [event.type, event.orderId])).toEqual([
      ['order.preview_book', 'o1'],
    ]);
    expect((await db.doc('orders/o1').get()).get('status')).toBe('qa_failed');
  });

  it('en revisión muestra las fotos del chico y su personaje; fuera de revisión no', async () => {
    await db.doc('books/b1').set({ childId: 'c1' });
    await db.doc('photos/p1').set({ ownerUid: 'ana', childId: 'c1', storagePath: 'ana/p1.jpg' });
    await order('o1', {
      status: 'qa_failed',
      snapshot: { character: { sheetPath: 'orders/o1/sheet.webp' }, pages: [] },
    });
    await order('o2', { status: 'ready' });
    const open = (await get('/v1/admin/orders/o1')).json<{
      reference: { photos: string[]; character: string | null } | null;
    }>();
    expect(open.reference?.photos).toHaveLength(1);
    expect(open.reference?.character).toBeTruthy();
    const closed = (await get('/v1/admin/orders/o2')).json<{ reference: unknown }>();
    expect(closed.reference).toBeNull();
  });

  it('carga el teléfono de quien recibe en un pedido que la imprenta rechazó; queda auditado sin el número', async () => {
    await order('o1', {
      status: 'qa_failed',
      shippingAddress: {
        name: 'Ana',
        line1: 'Calle 1',
        line2: null,
        city: 'Buenos Aires',
        state: null,
        postalCode: 'C1425',
        country: 'AR',
        phone: null,
      },
    });
    await order('o2', { status: 'paid' });
    const detail = async () =>
      (await get('/v1/admin/orders/o1')).json<{ shipping: { hasPhone: boolean } }>().shipping;
    expect((await detail()).hasPhone).toBe(false);
    expect(
      (await post('/v1/admin/orders/o2/shipping-contact', { phone: '+54 11 5555 1234' }))
        .statusCode,
    ).toBe(409);
    expect((await post('/v1/admin/orders/o1/shipping-contact', { phone: 'abc' })).statusCode).toBe(
      400,
    );
    const ok = await post('/v1/admin/orders/o1/shipping-contact', { phone: '+54 11 5555 1234' });
    expect(ok.statusCode).toBe(200);
    expect((await detail()).hasPhone).toBe(true);
    const audit = await db
      .collection(COLLECTIONS.auditLog)
      .where('action', '==', 'order.set_shipping_contact')
      .get();
    expect(audit.docs).toHaveLength(1);
    expect(JSON.stringify(audit.docs[0]?.data())).not.toContain('5555');
  });

  it('corrige la dirección antes de la imprenta, con el mismo país; queda auditado sin los datos', async () => {
    await order('o1', {
      status: 'ready',
      shippingAddress: {
        name: 'Ana',
        line1: 'San Martín 1234',
        line2: null,
        city: 'Rosario',
        state: null,
        postalCode: 'S2000',
        country: 'AR',
        phone: '+54 11 5555 1234',
        taxId: '20-12345678-6',
      },
    });
    await order('o2', { status: 'sent_to_print', shippingAddress: { country: 'AR' } });
    const fixed = {
      name: 'Ana Pérez',
      line1: 'Av. San Martín 1234',
      line2: 'Piso 3',
      city: 'Córdoba',
      state: 'Córdoba',
      postalCode: 'X5000',
    };
    expect((await post('/v1/admin/orders/o2/shipping-address', fixed)).statusCode).toBe(409);
    expect(
      (await post('/v1/admin/orders/o1/shipping-address', { ...fixed, postalCode: '12' }))
        .statusCode,
    ).toBe(400);
    const ok = await post('/v1/admin/orders/o1/shipping-address', fixed);
    expect(ok.statusCode).toBe(200);
    const saved = (await db.collection(COLLECTIONS.orders).doc('o1').get()).get(
      'shippingAddress',
    ) as Record<string, unknown>;
    expect(saved).toMatchObject({
      ...fixed,
      country: 'AR',
      phone: '+54 11 5555 1234',
      taxId: '20-12345678-6',
    });
    const audit = await db
      .collection(COLLECTIONS.auditLog)
      .where('action', '==', 'order.set_shipping_address')
      .get();
    expect(audit.docs).toHaveLength(1);
    expect(JSON.stringify(audit.docs[0]?.data())).not.toContain('Córdoba');
  });
});
