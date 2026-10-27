import {
  COLLECTIONS,
  normalizeFirestoreData,
  orderSchema,
  type AdminOrderPipeline,
} from '@storynido/shared';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { initFirebaseAdmin } from '../firebase';
import { RecordingPublisher } from '../orders/events';
import { auth, createTestApp } from '../test-helpers';

const db = getFirestore(initFirebaseAdmin('demo-storynido-test'));
const ADMIN = 'token-admin:admin';
const USER = 'token-ana';

type App = Awaited<ReturnType<typeof createTestApp>>['app'];

describe('pipeline del pedido (API)', () => {
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
    for (const name of [COLLECTIONS.orders, COLLECTIONS.books, COLLECTIONS.auditLog]) {
      await db.recursiveDelete(db.collection(name));
    }
  });

  async function seedOrder(status: string) {
    const ref = db.collection(COLLECTIONS.orders).doc('o1');
    await ref.set({
      ownerUid: 'ana',
      bookId: 'b1',
      status,
      channel: 'events',
      costsUsdMicros: { ai: 201_000, print: 0, shipping: 0 },
      pipeline: {
        generation: 0,
        runId: 'run-1',
        startedAt: new Date(),
        finishedAt: null,
        failedStep: 'quality_check',
        error: 'falló',
      },
    });
    await ref.collection(COLLECTIONS.orderSteps).doc('prepare_photo').set({
      status: 'succeeded',
      generation: 0,
      attempts: 1,
      durationMs: 12,
      error: null,
      costUsdMicros: 0,
    });
    await ref.collection(COLLECTIONS.orderSteps).doc('quality_check').set({
      status: 'failed',
      generation: 0,
      attempts: 3,
      durationMs: 40,
      error: 'falló',
      costUsdMicros: 0,
    });
  }

  it('el admin ve los pasos del pipeline en orden, con intentos y costos', async () => {
    await seedOrder('qa_failed');
    const forbidden = await app.inject({
      method: 'GET',
      url: '/v1/admin/orders/o1/pipeline',
      headers: auth(USER),
    });
    expect(forbidden.statusCode).toBe(403);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/orders/o1/pipeline',
      headers: auth(ADMIN),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<AdminOrderPipeline>();
    expect(body.channel).toBe('events');
    expect(body.pipeline.failedStep).toBe('quality_check');
    expect(body.steps.map((step) => [step.name, step.attempts])).toEqual([
      ['prepare_photo', 1],
      ['quality_check', 3],
    ]);
    expect(body.costsUsdMicros.ai).toBe(201_000);
  });

  it('reintentar un paso publica el evento y queda en auditoría; solo en revisión', async () => {
    await seedOrder('qa_failed');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/orders/o1/retry',
      headers: auth(ADMIN),
      payload: { fromStep: 'quality_check' },
    });
    expect(res.statusCode).toBe(200);
    expect(events.events).toEqual([
      {
        type: 'order.retry_step',
        orderId: 'o1',
        fromStep: 'quality_check',
        requestId: res.json<{ requestId: string }>().requestId,
      },
    ]);
    const audit = await db.collection(COLLECTIONS.auditLog).get();
    expect(audit.docs.map((doc) => doc.data().action as unknown)).toEqual(['order.retry_step']);

    await db.collection(COLLECTIONS.orders).doc('o1').update({ status: 'generating' });
    const busy = await app.inject({
      method: 'POST',
      url: '/v1/admin/orders/o1/retry',
      headers: auth(ADMIN),
      payload: {},
    });
    expect(busy.statusCode).toBe(409);
  });

  it('regenerar se permite en revisión o con el libro listo', async () => {
    await seedOrder('ready');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/orders/o1/regenerate',
      headers: auth(ADMIN),
    });
    expect(res.statusCode).toBe(200);
    expect(events.events[0]?.type).toBe('order.regenerate');
    const missing = await app.inject({
      method: 'POST',
      url: '/v1/admin/orders/nope/regenerate',
      headers: auth(ADMIN),
    });
    expect(missing.statusCode).toBe(404);
  });

  it('desarrollo: un pedido pagado simulado crea el pedido válido y dispara order.paid', async () => {
    await db.collection(COLLECTIONS.books).doc('b1').set({
      ownerUid: 'ana',
      status: 'preview_ready',
      channel: 'events',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/dev/books/b1/paid-order',
      headers: auth(USER),
      payload: { format: 'softcover', quantity: 20 },
    });
    expect(res.statusCode).toBe(200);
    const { orderId, requestId } = res.json<{ orderId: string; requestId: string }>();
    expect(events.events).toEqual([{ type: 'order.paid', orderId, requestId }]);

    const stored = (await db.collection(COLLECTIONS.orders).doc(orderId).get()).data();
    const order = orderSchema.parse(normalizeFirestoreData(stored));
    expect(order.status).toBe('paid');
    expect(order.channel).toBe('events');
    expect(order.items).toEqual([{ piece: 'book', format: 'softcover', quantity: 20 }]);

    // Otra persona no puede pagar un libro ajeno.
    const other = await app.inject({
      method: 'POST',
      url: '/v1/dev/books/b1/paid-order',
      headers: auth('token-luis'),
      payload: {},
    });
    expect(other.statusCode).toBe(404);
  });
});
