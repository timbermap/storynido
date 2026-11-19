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

  async function seedOrder(
    status: string,
    print = true,
    externalOrderId = 'po_1',
    printer = 'mock',
  ) {
    await db.doc('orders/o1').set({
      ownerUid: 'ana',
      bookId: 'b1',
      status,
      items: [{ piece: 'book', format: print ? 'softcover' : 'digital', quantity: 1 }],
      priceSnapshot: null,
      payment: { provider: 'mock', checkoutSessionId: null, paymentId: 'pay_1' },
      print: print
        ? { provider: printer, externalOrderId, trackingNumber: null, trackingUrl: null }
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

  it('mientras se crea el libro, el pedido dice la etapa, las páginas pintadas y cuánto falta', async () => {
    await seedOrder('generating', false);
    await db.doc('orders/o1').update({
      pipeline: { generation: 0, runId: 'r1', startedAt: new Date(Date.now() - 120_000) },
    });
    // Los pasos de la siembra son de un libro terminado: acá recién va por las ilustraciones.
    await db.doc('orders/o1/steps/layout_pdf').delete();
    await db.doc('orders/o1/steps/deliver').delete();
    for (const name of ['prepare_photo', 'generate_story']) {
      await db.doc(`orders/o1/steps/${name}`).set({ generation: 0, status: 'succeeded' });
    }
    await db.doc('orders/o1/steps/generate_illustrations').set({
      generation: 0,
      status: 'running',
      startedAt: new Date(Date.now() - 30_000),
      output: null,
    });
    for (let index = 0; index < 4; index += 1) {
      await db.doc(`orders/o1/steps/generate_illustrations/pages/${String(index)}`).set({
        index,
        generation: 0,
        status: index < 3 ? 'succeeded' : 'running',
      });
    }
    const view = await app.inject({
      method: 'GET',
      url: '/v1/orders/o1',
      headers: auth('token-ana'),
    });
    const progress = view.json<PublicOrder>().progress;
    expect(progress?.stage).toBe('illustrations');
    expect(progress?.pagesDone).toBe(3);
    expect(progress?.pagesTotal).toBe(4);
    expect(progress?.fraction).toBeGreaterThan(0.3);
    expect(progress?.fraction).toBeLessThan(1);
    expect(progress?.remainingSeconds).toBeGreaterThan(0);
    expect(progress?.late).toBe(false);

    // Con el libro listo ya no hay avance que mostrar.
    await db.doc('orders/o1').update({ status: 'ready' });
    const ready = await app.inject({
      method: 'GET',
      url: '/v1/orders/o1',
      headers: auth('token-ana'),
    });
    expect(ready.json<PublicOrder>().progress).toBeNull();
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

  it('con una imprenta real en staging, la simulación avanza el pedido sin llamarla', async () => {
    await seedOrder('sent_to_print', true, 'po_real', 'gelato');
    const step = () =>
      app.inject({
        method: 'POST',
        url: '/v1/dev/orders/o1/simulate-print',
        headers: auth('token-ana'),
      });
    expect((await step()).json<{ status: string }>().status).toBe('in_production');
    expect((await step()).json<{ status: string }>().status).toBe('shipped');
    const shipped = (await db.doc('orders/o1').get()).get('print.trackingNumber') as string;
    expect(shipped).toBeTruthy();
    expect((await step()).json<{ status: string }>().status).toBe('delivered');
  });

  it('el admin de staging avanza la imprenta de cualquier pedido', async () => {
    await seedOrder('sent_to_print', true, 'po_real', 'gelato');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/orders/o1/simulate-print',
      headers: auth('token-root:admin:mfa'),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ status: string }>().status).toBe('in_production');
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

  it('comprobante de compra: PDF con los datos del pedido pagado, solo para su dueño (no es factura)', async () => {
    await seedOrder('ready', false);
    await db.doc('orders/o1').update({
      bookTitle: 'Tomás y el faro',
      priceSnapshot: {
        currency: 'USD',
        components: [{ code: 'book', unitMinor: 1699, quantity: 1, totalMinor: 1699 }],
        subtotalMinor: 1699,
        discount: { minor: 0, reason: null, label: null },
        shipping: { minor: 0, etaDaysMin: 0, etaDaysMax: 0, pending: false },
        tax: { minor: 0, basisPoints: 0, included: true },
        totalMinor: 1699,
      },
    });
    const mine = await app.inject({
      method: 'GET',
      url: '/v1/orders/o1/receipt',
      headers: auth('token-ana'),
    });
    expect(mine.statusCode).toBe(200);
    const body = mine.json<{ filename: string; contentType: string; base64: string }>();
    expect(body.contentType).toBe('application/pdf');
    expect(body.filename).toBe('comprobante-storynido-SN-O1.pdf');
    expect(Buffer.from(body.base64, 'base64').subarray(0, 5).toString()).toBe('%PDF-');

    const other = await app.inject({
      method: 'GET',
      url: '/v1/orders/o1/receipt',
      headers: auth('token-luis'),
    });
    expect(other.statusCode).toBe(404);

    await db.doc('orders/o1').update({ status: 'pending_payment' });
    const unpaid = await app.inject({
      method: 'GET',
      url: '/v1/orders/o1/receipt',
      headers: auth('token-ana'),
    });
    expect(unpaid.statusCode).toBe(404);
  });
});
