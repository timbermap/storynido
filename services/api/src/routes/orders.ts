import { randomUUID } from 'node:crypto';

import {
  COLLECTIONS,
  PIPELINE_STEPS,
  apiRoutes,
  type AuditLogEntry,
  type OrderStatus,
  type PipelineEvent,
  type PipelineStep,
} from '@storynido/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import { AppError } from '../errors';
import { addRoute } from '../plugins/route';

interface Params {
  orderId: string;
}
type RetryBody = z.output<(typeof apiRoutes)['adminRetryOrderStep']['body']>;
type PaidOrderBody = z.output<(typeof apiRoutes)['devPaidOrder']['body']>;

function iso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate(): Date }).toDate().toISOString();
  }
  return null;
}

/**
 * Pipeline del pedido desde la API: el admin ve el estado y pide reintentos o regeneraciones
 * (los ejecuta el worker); en desarrollo, un pedido pagado simulado dispara el pipeline.
 */
export function registerOrderRoutes(app: FastifyInstance): void {
  const { db, pipelineEvents, config } = app.deps;
  const orders = db.collection(COLLECTIONS.orders);

  async function load(orderId: string) {
    const snap = await orders.doc(orderId).get();
    if (!snap.exists) throw new AppError(404, 'not_found', 'Pedido inexistente.');
    return snap.data() as { status: OrderStatus } & Record<string, unknown>;
  }

  /** Publica el pedido de reintento o regeneración y lo deja en auditoría. */
  async function request(
    req: FastifyRequest,
    orderId: string,
    event: Omit<PipelineEvent, 'requestId' | 'orderId'>,
    allowed: OrderStatus[],
  ) {
    const order = await load(orderId);
    if (!allowed.includes(order.status)) {
      throw new AppError(409, 'bad_request', `El pedido está en "${order.status}".`);
    }
    const requestId = randomUUID();
    const audit: AuditLogEntry = {
      actorUid: req.user?.uid ?? null,
      actorEmail: req.user?.email ?? null,
      action: event.type === 'order.regenerate' ? 'order.regenerate' : 'order.retry_step',
      entity: COLLECTIONS.orders,
      entityId: orderId,
      before: { status: order.status },
      after: { requestId, ...(event.fromStep ? { fromStep: event.fromStep } : {}) },
      at: new Date(),
    };
    await db.collection(COLLECTIONS.auditLog).add(audit);
    await pipelineEvents.publish({ ...event, orderId, requestId });
    return { accepted: true as const, requestId };
  }

  addRoute(app, apiRoutes.adminOrderPipeline, {}, async (req) => {
    const { orderId } = req.params as Params;
    const order = await load(orderId);
    const pipeline = (order.pipeline ?? {}) as Record<string, unknown>;
    const steps = await orders.doc(orderId).collection(COLLECTIONS.orderSteps).get();
    const byName = new Map(steps.docs.map((doc) => [doc.id, doc.data()]));
    const costs = (order.costsUsdMicros ?? {}) as Record<string, number | undefined>;
    return {
      orderId,
      status: order.status,
      channel: (order.channel as 'families' | undefined) ?? 'families',
      pipeline: {
        generation: Number(pipeline.generation ?? 0),
        runId: (pipeline.runId as string | null | undefined) ?? null,
        startedAt: iso(pipeline.startedAt),
        finishedAt: iso(pipeline.finishedAt),
        failedStep: (pipeline.failedStep as PipelineStep | null | undefined) ?? null,
        error: (pipeline.error as string | null | undefined) ?? null,
      },
      steps: PIPELINE_STEPS.flatMap((name) => {
        const data = byName.get(name);
        if (!data) return [];
        return [
          {
            name,
            status: String(data.status),
            generation: Number(data.generation ?? 0),
            attempts: Number(data.attempts ?? 0),
            durationMs: typeof data.durationMs === 'number' ? data.durationMs : null,
            error: typeof data.error === 'string' ? data.error : null,
            costUsdMicros: Number(data.costUsdMicros ?? 0),
          },
        ];
      }),
      costsUsdMicros: { ai: costs.ai ?? 0, print: costs.print ?? 0, shipping: costs.shipping ?? 0 },
    };
  });

  addRoute(app, apiRoutes.adminRetryOrderStep, {}, (req) => {
    const { orderId } = req.params as Params;
    const { fromStep } = req.body as RetryBody;
    return request(req, orderId, { type: 'order.retry_step', fromStep }, ['qa_failed']);
  });

  addRoute(app, apiRoutes.adminRegenerateOrder, {}, (req) => {
    const { orderId } = req.params as Params;
    return request(req, orderId, { type: 'order.regenerate' }, ['qa_failed', 'ready']);
  });

  // Pagos simulados: solo fuera de producción (los pagos reales llegan en la fase 11).
  if (!config.devToolsEnabled) return;

  addRoute(app, apiRoutes.devPaidOrder, {}, async (req) => {
    const user = req.user;
    if (!user) throw new AppError(401, 'unauthorized', 'Inicia sesión.');
    const { bookId } = req.params as { bookId: string };
    const body = req.body as PaidOrderBody;
    const book = (await db.collection(COLLECTIONS.books).doc(bookId).get()).data();
    if (book?.ownerUid !== user.uid) throw new AppError(404, 'not_found', 'Libro inexistente.');
    if (book.status !== 'preview_ready') {
      throw new AppError(409, 'bad_request', 'El libro necesita su vista previa lista.');
    }
    const ref = orders.doc();
    const now = new Date();
    await ref.set({
      ownerUid: user.uid,
      bookId,
      status: 'paid',
      channel: typeof book.channel === 'string' ? book.channel : 'families',
      items: [{ piece: 'book', format: body.format, quantity: body.quantity }],
      country: 'US',
      currency: 'USD',
      amounts: { subtotalMinor: 0, discountMinor: 0, shippingMinor: 0, taxMinor: 0, totalMinor: 0 },
      couponCode: null,
      gift: { isGift: false, message: null },
      shippingAddress: null,
      payment: { provider: 'mock', checkoutSessionId: null, paymentId: `mock_${ref.id}` },
      print: null,
      costsUsdMicros: { ai: 0, print: 0, shipping: 0 },
      pipeline: {
        generation: 0,
        runId: null,
        startedAt: null,
        finishedAt: null,
        failedStep: null,
        error: null,
      },
      createdAt: now,
      updatedAt: now,
    });
    // Clave determinística: el mismo pago no dispara dos pipelines.
    const requestId = `paid:${ref.id}:mock_${ref.id}`;
    await pipelineEvents.publish({ type: 'order.paid', orderId: ref.id, requestId });
    return { orderId: ref.id, requestId };
  });
}
