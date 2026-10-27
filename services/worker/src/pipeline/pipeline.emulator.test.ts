import { COLLECTIONS, STEP_POLICIES, type PipelineStep } from '@storynido/shared';
import Fastify from 'fastify';
import { deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../app';
import { simulatedHandlers, type PipelineHandlers, type SimpleStep } from './handlers';
import { InlineDispatcher, LocalOrchestrator } from './orchestrators';
import { Pipeline } from './pipeline';

const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-storynido-test' }));
const log = Fastify({ logger: false }).log;

/** Pasos simulados que cuentan las llamadas y pueden fallar a pedido. */
function countingHandlers() {
  const calls: Record<string, number> = {};
  const failures: Partial<Record<SimpleStep, number>> = {};
  const pageFailures = new Map<number, number>();
  const count = (key: string) => (calls[key] = (calls[key] ?? 0) + 1);
  const base = simulatedHandlers();
  const handlers: PipelineHandlers = {
    steps: Object.fromEntries(
      (Object.keys(base.steps) as SimpleStep[]).map((name) => [
        name,
        async (ctx: Parameters<PipelineHandlers['steps'][SimpleStep]>[0]) => {
          count(name);
          const left = failures[name] ?? 0;
          if (left > 0) {
            failures[name] = left - 1;
            throw new Error(`${name} falló`);
          }
          const result = await base.steps[name](ctx);
          return name === 'generate_story' ? { ...result, costUsdMicros: 1000 } : result;
        },
      ]),
    ) as PipelineHandlers['steps'],
    planIllustrations: (ctx) => base.planIllustrations(ctx),
    illustratePage: async (ctx) => {
      count(`page-${String(ctx.index)}`);
      const left = pageFailures.get(ctx.index) ?? 0;
      if (left > 0) {
        pageFailures.set(ctx.index, left - 1);
        throw new Error(`página ${String(ctx.index)} falló`);
      }
      return { ...(await base.illustratePage(ctx)), costUsdMicros: 40_000 };
    },
  };
  return { handlers, calls, failures, pageFailures };
}

function setup() {
  const fake = countingHandlers();
  const current = (): Pipeline => pipeline;
  const orchestrator = new LocalOrchestrator(current, log, 1);
  const dispatcher = new InlineDispatcher(current, log, 1);
  const pipeline = new Pipeline(db, fake.handlers, orchestrator, dispatcher, log);
  const settle = async () => {
    await orchestrator.idle();
    await dispatcher.idle();
  };
  return { ...fake, pipeline, settle };
}

async function seedOrder(id: string, status = 'paid') {
  await db
    .collection(COLLECTIONS.orders)
    .doc(id)
    .set({
      ownerUid: 'user-1',
      bookId: 'book-1',
      status,
      channel: 'events',
      items: [{ piece: 'book', format: 'softcover', quantity: 3 }],
      costsUsdMicros: { ai: 0, print: 0, shipping: 0 },
      pipeline: {
        generation: 0,
        runId: null,
        startedAt: null,
        finishedAt: null,
        failedStep: null,
        error: null,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
}

interface OrderData {
  status: string;
  costsUsdMicros: { ai: number };
  pipeline: {
    generation: number;
    runId: string | null;
    finishedAt: unknown;
    failedStep: string | null;
    error: string | null;
  };
}

interface StepData {
  status: string;
  attempts: number;
  idempotencyKey: string;
  durationMs: number | null;
  costUsdMicros: number;
  output: { images?: unknown[]; copies?: number };
}

const orders = () => db.collection(COLLECTIONS.orders);
const order = async (id: string) => (await orders().doc(id).get()).data() as OrderData | undefined;
const steps = (id: string) => orders().doc(id).collection(COLLECTIONS.orderSteps);
const step = async (id: string, name: PipelineStep) =>
  (await steps(id).doc(name).get()).data() as StepData | undefined;
const pages = async (id: string) =>
  (
    await steps(id).doc('generate_illustrations').collection(COLLECTIONS.illustrationTasks).get()
  ).docs.map((doc) => doc.data() as { status: string });

describe('pipeline del pedido', () => {
  beforeEach(async () => {
    for (const name of [COLLECTIONS.orders, COLLECTIONS.adminAlerts]) {
      await db.recursiveDelete(db.collection(name));
    }
  });

  afterAll(async () => {
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  it('de paid a ready: corre los 6 pasos, reparte las páginas y suma el costo', async () => {
    const { pipeline, settle, calls } = setup();
    await seedOrder('o1');
    const outcome = await pipeline.handleEvent({
      type: 'order.paid',
      orderId: 'o1',
      requestId: 'paid:o1',
    });
    expect(outcome.state).toBe('started');
    await settle();

    const done = await order('o1');
    expect(done?.status).toBe('ready');
    expect(done?.pipeline.finishedAt).toBeTruthy();
    // Historia (0,001) + portada y 4 páginas (0,04 c/u).
    expect(done?.costsUsdMicros.ai).toBe(1000 + 5 * 40_000);

    for (const name of [
      'prepare_photo',
      'generate_story',
      'quality_check',
      'layout_pdf',
    ] as const) {
      const record = await step('o1', name);
      expect(record?.status).toBe('succeeded');
      expect(record?.attempts).toBe(1);
      expect(record?.idempotencyKey).toBe(`o1:g0:${name}`);
      expect(record?.durationMs).toBeGreaterThanOrEqual(0);
    }
    const illustrations = await step('o1', 'generate_illustrations');
    expect(illustrations?.output.images).toHaveLength(5);
    expect(illustrations?.costUsdMicros).toBe(200_000);
    // Un solo diseño, 3 copias (Eventos).
    expect((await step('o1', 'deliver'))?.output.copies).toBe(3);
    expect((await pages('o1')).every((page) => page.status === 'succeeded')).toBe(true);
    expect(calls.generate_story).toBe(1);
  });

  it('el mismo evento dos veces no duplica nada', async () => {
    const { pipeline, settle, calls } = setup();
    await seedOrder('o1');
    const event = { type: 'order.paid' as const, orderId: 'o1', requestId: 'paid:o1' };
    const [first, second] = await Promise.all([
      pipeline.handleEvent(event),
      pipeline.handleEvent(event),
    ]);
    expect([first.state, second.state].sort()).toEqual(['duplicate', 'started']);
    await settle();
    // Otro "pagado" con otra clave tampoco: el pedido ya no está en "paid".
    expect((await pipeline.handleEvent({ ...event, requestId: 'paid:o1:again' })).state).toBe(
      'ignored',
    );
    await settle();

    expect((await order('o1'))?.status).toBe('ready');
    expect(calls.prepare_photo).toBe(1);
    expect(calls.generate_story).toBe(1);
    expect(calls['page-0']).toBe(1);
    expect((await order('o1'))?.costsUsdMicros.ai).toBe(201_000);
  });

  it('volver a ejecutar un paso terminado no lo repite', async () => {
    const { pipeline, settle, calls } = setup();
    await seedOrder('o1');
    await pipeline.handleEvent({ type: 'order.paid', orderId: 'o1', requestId: 'r1' });
    await settle();
    // Simula a Workflows reintentando un paso que ya había terminado.
    await db.collection(COLLECTIONS.orders).doc('o1').update({ status: 'generating' });
    const again = await pipeline.runStep('o1', 'generate_story', 0);
    expect(again.state).toBe('skipped');
    expect(calls.generate_story).toBe(1);
  });

  it('reintenta un paso que falla y sigue', async () => {
    const { pipeline, settle, failures } = setup();
    failures.generate_story = 2;
    await seedOrder('o1');
    await pipeline.handleEvent({ type: 'order.paid', orderId: 'o1', requestId: 'r1' });
    await settle();
    expect((await order('o1'))?.status).toBe('ready');
    expect((await step('o1', 'generate_story'))?.attempts).toBe(3);
  });

  it('si un paso agota los reintentos: revisión manual y aviso al admin', async () => {
    const { pipeline, settle, failures, calls } = setup();
    failures.quality_check = 99;
    await seedOrder('o1');
    await pipeline.handleEvent({ type: 'order.paid', orderId: 'o1', requestId: 'r1' });
    await settle();

    const failed = await order('o1');
    expect(failed?.status).toBe('qa_failed');
    expect(failed?.pipeline.failedStep).toBe('quality_check');
    expect(failed?.pipeline.error).toContain('quality_check falló');
    expect(calls.quality_check).toBe(STEP_POLICIES.quality_check.maxAttempts);
    expect(calls.layout_pdf).toBeUndefined();
    const record = await step('o1', 'quality_check');
    expect(record?.status).toBe('failed');
    expect(record?.attempts).toBe(STEP_POLICIES.quality_check.maxAttempts);
    const alerts = await db.collection(COLLECTIONS.adminAlerts).get();
    expect(alerts.docs.map((doc) => doc.data().step as unknown)).toEqual(['quality_check']);
  });

  it('una página que falla siempre deja el pedido en revisión; reintentar rehace solo esa página', async () => {
    const { pipeline, settle, pageFailures, calls } = setup();
    pageFailures.set(2, 999);
    await seedOrder('o1');
    await pipeline.handleEvent({ type: 'order.paid', orderId: 'o1', requestId: 'r1' });
    await settle();

    const failed = await order('o1');
    expect(failed?.status).toBe('qa_failed');
    expect(failed?.pipeline.failedStep).toBe('generate_illustrations');
    expect((await step('o1', 'generate_illustrations'))?.attempts).toBe(
      STEP_POLICIES.generate_illustrations.maxAttempts,
    );
    expect(calls['page-0']).toBe(1);

    // El admin reintenta desde las ilustraciones (ya se arregló la causa).
    pageFailures.delete(2);
    const retry = await pipeline.handleEvent({
      type: 'order.retry_step',
      orderId: 'o1',
      requestId: 'retry-1',
    });
    expect(retry.state).toBe('started');
    await settle();

    expect((await order('o1'))?.status).toBe('ready');
    // Las páginas que ya estaban bien no se vuelven a pintar; la historia tampoco se rehace.
    expect(calls['page-0']).toBe(1);
    expect(calls.generate_story).toBe(1);
    expect((await pages('o1')).every((page) => page.status === 'succeeded')).toBe(true);
  });

  it('reintentar desde la historia rehace la historia y todas las páginas', async () => {
    const { pipeline, settle, failures, calls } = setup();
    failures.layout_pdf = 99;
    await seedOrder('o1');
    await pipeline.handleEvent({ type: 'order.paid', orderId: 'o1', requestId: 'r1' });
    await settle();
    expect((await order('o1'))?.status).toBe('qa_failed');

    failures.layout_pdf = 0;
    await pipeline.handleEvent({
      type: 'order.retry_step',
      orderId: 'o1',
      requestId: 'retry-1',
      fromStep: 'generate_story',
    });
    await settle();
    expect((await order('o1'))?.status).toBe('ready');
    expect(calls.prepare_photo).toBe(1);
    expect(calls.generate_story).toBe(2);
    expect(calls['page-0']).toBe(2);
  });

  it('regenerar el libro completo sube la generación y cambia las claves', async () => {
    const { pipeline, settle, calls } = setup();
    await seedOrder('o1');
    await pipeline.handleEvent({ type: 'order.paid', orderId: 'o1', requestId: 'r1' });
    await settle();
    const firstRun = (await order('o1'))?.pipeline.runId ?? '';

    await pipeline.handleEvent({ type: 'order.regenerate', orderId: 'o1', requestId: 'regen-1' });
    await settle();
    const after = await order('o1');
    expect(after?.status).toBe('ready');
    expect(after?.pipeline.generation).toBe(1);
    expect(calls.prepare_photo).toBe(2);
    expect(calls['page-4']).toBe(2);
    expect((await step('o1', 'deliver'))?.idempotencyKey).toBe('o1:g1:deliver');
    // Cerrar con la ejecución vieja no toca el pedido.
    expect(await pipeline.finish('o1', firstRun)).toBe(false);
    expect(await pipeline.fail('o1', firstRun, 'deliver', 'tarde')).toBe(false);
    expect((await order('o1'))?.status).toBe('ready');
  });

  it('no arranca con un pedido sin pagar ni con uno que no existe', async () => {
    const { pipeline } = setup();
    await seedOrder('o1', 'pending_payment');
    expect(
      (await pipeline.handleEvent({ type: 'order.paid', orderId: 'o1', requestId: 'r1' })).state,
    ).toBe('ignored');
    expect(
      (await pipeline.handleEvent({ type: 'order.paid', orderId: 'nope', requestId: 'r2' })).state,
    ).toBe('ignored');
    expect((await order('o1'))?.status).toBe('pending_payment');
  });

  it('acepta eventos por la suscripción push de Pub/Sub y confirma los mal formados', async () => {
    const { pipeline, settle } = setup();
    const app = buildApp({ version: 'test', pipeline: () => pipeline });
    await seedOrder('o1');
    const data = Buffer.from(
      JSON.stringify({ type: 'order.paid', orderId: 'o1', requestId: 'paid:o1' }),
    ).toString('base64');
    const res = await app.inject({
      method: 'POST',
      url: '/events/pubsub',
      payload: { message: { data, messageId: '1' }, subscription: 's' },
    });
    expect(res.json<{ state: string }>().state).toBe('started');
    await settle();
    expect((await order('o1'))?.status).toBe('ready');

    const bad = await app.inject({
      method: 'POST',
      url: '/events/pubsub',
      payload: { message: { data: Buffer.from('{"type":"x"}').toString('base64') } },
    });
    expect(bad.statusCode).toBe(204);
    await app.close();
  });
});
