import {
  mockPrintWebhookSequence,
  signMockPrintWebhook,
  type ProviderRegistry,
} from '@storynido/providers';
import { COLLECTIONS, type PublicOrder } from '@storynido/shared';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { initFirebaseAdmin } from '../firebase';
import { auth, createTestApp } from '../test-helpers';

const db = getFirestore(initFirebaseAdmin('demo-storynido-test'));
type App = Awaited<ReturnType<typeof createTestApp>>['app'];

describe('imprenta, descarga y cancelación (fase 12)', () => {
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
    for (const name of [
      COLLECTIONS.orders,
      'printEvents',
      COLLECTIONS.adminAlerts,
      COLLECTIONS.auditLog,
    ]) {
      await db.recursiveDelete(db.collection(name));
    }
  });

  async function seedOrder(status: string, print = true, externalOrderId = 'po_1') {
    await db.doc('orders/o1').set({
      ownerUid: 'ana',
      bookId: 'b1',
      status,
      items: [{ piece: 'book', format: print ? 'softcover' : 'digital', quantity: 1 }],
      priceSnapshot: null,
      payment: { provider: 'mock', checkoutSessionId: null, paymentId: 'pay_1' },
      print: print
        ? { provider: 'mock', externalOrderId, trackingNumber: null, trackingUrl: null }
        : null,
      createdAt: new Date(),
    });
    await providers
      .storage()
      .upload(
        { bucket: 'pdfs', path: 'orders/o1/g0/digital-book.pdf' },
        new Uint8Array([37, 80, 68, 70]),
        'application/pdf',
      );
    await db.doc('orders/o1/steps/layout_pdf').set({
      output: {
        files: [
          { format: 'digital', kind: 'book', path: 'orders/o1/g0/digital-book.pdf' },
          { format: 'digital', kind: 'kit_zip', path: 'orders/o1/g0/kit.zip' },
        ],
      },
    });
    await db.doc('orders/o1/steps/deliver').set({
      status: 'succeeded',
      output: { digitalPath: 'orders/o1/g0/digital-book.pdf', sentToPrint: print },
    });
  }

  const webhook = (
    payload: Parameters<typeof signMockPrintWebhook>[1],
    secret = 'test-webhook-secret',
  ) => {
    const signed = signMockPrintWebhook(secret, payload);
    return app.inject({
      method: 'POST',
      url: '/v1/webhooks/print/mock',
      headers: { 'content-type': 'application/json', ...signed.headers },
      payload: signed.rawBody,
    });
  };
  const status = async () => (await db.doc('orders/o1').get()).get('status') as string;

  it('la imprenta recorre producción → envío (con seguimiento) → entrega, sin duplicar', async () => {
    await seedOrder('sent_to_print');
    const [production, shipped, delivered] = mockPrintWebhookSequence('o1', 'po_1');
    if (!production || !shipped || !delivered) throw new Error('secuencia incompleta');

    expect((await webhook(production, 'otro')).statusCode).toBe(400);
    expect((await webhook(production)).json<{ outcome: string }>().outcome).toBe('processed');
    expect(await status()).toBe('in_production');
    expect((await webhook(production)).json<{ outcome: string }>().outcome).toBe('duplicate');

    await webhook(shipped);
    const order = (await db.doc('orders/o1').get()).data();
    expect(order?.status).toBe('shipped');
    expect((order?.print as { trackingUrl: string }).trackingUrl).toContain('tracking');
    await webhook(delivered);
    expect(await status()).toBe('delivered');

    const view = await app.inject({
      method: 'GET',
      url: '/v1/orders/o1',
      headers: auth('token-ana'),
    });
    expect(view.json<PublicOrder>().tracking?.number).toBeTruthy();
  });

  it('un webhook de otro pedido de imprenta se ignora', async () => {
    await seedOrder('sent_to_print');
    const [production] = mockPrintWebhookSequence('o1', 'po_otro');
    if (!production) throw new Error('secuencia incompleta');
    expect((await webhook(production)).json<{ outcome: string }>().outcome).toBe('ignored');
    expect(await status()).toBe('sent_to_print');
  });

  it('la imprenta simulada avanza un paso por vez', async () => {
    await seedOrder('sent_to_print');
    const step = () =>
      app.inject({
        method: 'POST',
        url: '/v1/dev/orders/o1/simulate-print',
        headers: auth('token-ana'),
      });
    expect((await step()).json<{ status: string }>().status).toBe('in_production');
    expect((await step()).json<{ status: string }>().status).toBe('shipped');
    expect((await step()).json<{ status: string }>().status).toBe('delivered');
    expect((await step()).statusCode).toBe(409);
  });

  it('cancelar en la imprenta: se puede antes del envío, después no', async () => {
    // Otro pedido de imprenta: la imprenta simulada recuerda los que ya despachó.
    await seedOrder('sent_to_print', true, 'po_cancel');
    const cancel = () =>
      app.inject({
        method: 'POST',
        url: '/v1/admin/orders/o1/cancel-print',
        headers: auth('token-admin:admin'),
      });
    const first = await cancel();
    expect(first.json<{ status?: string; error?: unknown }>()).toEqual({ status: 'cancelled' });
    expect((await db.collection(COLLECTIONS.auditLog).get()).size).toBe(1);

    await seedOrder('shipped', true, 'po_cancel');
    expect((await cancel()).statusCode).toBe(409);
  });

  it('descarga del digital: URL firmada solo para el dueño y con el libro listo', async () => {
    await seedOrder('ready', false);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/orders/o1/download',
      headers: auth('token-ana'),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ url: string }>().url).toContain('digital-book.pdf');
    const other = await app.inject({
      method: 'GET',
      url: '/v1/orders/o1/download',
      headers: auth('token-luis'),
    });
    expect(other.statusCode).toBe(404);
    // Kit de Eventos: el ZIP con todas las piezas; una pieza que no se compró no está.
    const zip = await app.inject({
      method: 'GET',
      url: '/v1/orders/o1/download?file=kit_zip',
      headers: auth('token-ana'),
    });
    expect(zip.json<{ url: string }>().url).toContain('kit.zip');
    const missing = await app.inject({
      method: 'GET',
      url: '/v1/orders/o1/download?file=stickers',
      headers: auth('token-ana'),
    });
    expect(missing.statusCode).toBe(409);
    await db.doc('orders/o1').update({ status: 'generating' });
    const early = await app.inject({
      method: 'GET',
      url: '/v1/orders/o1/download',
      headers: auth('token-ana'),
    });
    expect(early.statusCode).toBe(409);
  });
});
