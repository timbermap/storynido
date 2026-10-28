import { randomUUID } from 'node:crypto';

import {
  COLLECTIONS,
  ILLUSTRATION_PAGE_POLICY,
  PIPELINE_STEPS,
  STEP_POLICIES,
  assertOrderTransition,
  stepIdempotencyKey,
  stepsFrom,
  type OrderStatus,
  type PipelineEvent,
  type PipelineStep,
} from '@storynido/shared';
import type { EmailNotifier } from '@storynido/emails';
import type { FastifyBaseLogger } from 'fastify';
import {
  FieldValue,
  type DocumentReference,
  type Firestore,
  type Transaction,
} from 'firebase-admin/firestore';

import {
  HumanReviewError,
  type PipelineHandlers,
  type PipelineOrder,
  type SimpleStep,
  type StepContext,
  type StepOutputs,
} from './handlers';

/** Una ejecución del pipeline: la arranca un evento y la sigue Workflows o el orquestador local. */
export interface PipelineRun {
  orderId: string;
  runId: string;
  generation: number;
  steps: { name: PipelineStep; maxAttempts: number; timeoutSeconds: number }[];
}

export interface Orchestrator {
  start(run: PipelineRun): Promise<void>;
}

export interface IllustrationTaskRef {
  orderId: string;
  generation: number;
  index: number;
  /** Número de reparto de esta página (sube con cada reintento de las ilustraciones). */
  dispatch: number;
}

/** Reparte las páginas a ilustrar (Cloud Tasks en la nube, el mismo proceso en local). */
export interface IllustrationDispatcher {
  dispatch(task: IllustrationTaskRef): Promise<void>;
}

export type EventOutcome =
  { state: 'started'; runId: string } | { state: 'duplicate' | 'ignored'; reason: string };

export type StepOutcome =
  | { state: 'succeeded' | 'skipped'; output: Record<string, unknown> }
  /** Ilustraciones repartidas: consultar el estado hasta que terminen. */
  | { state: 'waiting'; done: number; total: number }
  /** Otro intento tiene el paso tomado; volver a llamar más tarde (no cuenta como intento). */
  | { state: 'busy' }
  /** La ejecución ya no corresponde (el libro se regeneró o el pedido cambió de estado). */
  | { state: 'stale' }
  /** Reintentar no lo arregla: revisión manual sin más intentos. */
  | { state: 'human_review'; reason: string };

export type IllustrationStatus =
  | { state: 'succeeded' }
  | { state: 'waiting'; done: number; total: number }
  | { state: 'failed'; error: string }
  | { state: 'stale' };

interface OrderDoc {
  ownerUid: string;
  bookId: string;
  status: OrderStatus;
  channel?: string;
  items?: PipelineOrder['items'];
  sourceOrderId?: string | null;
  pipeline?: {
    generation?: number;
    runId?: string | null;
    failedStep?: PipelineStep | null;
  };
}

interface StepDoc {
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  generation: number;
  attempts: number;
  leaseUntil: unknown;
  startedAt: unknown;
  output: Record<string, unknown> | null;
}

interface PageDoc {
  index: number;
  generation: number;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  attempts: number;
  dispatches: number;
  error: string | null;
  costUsdMicros: number;
  imagePath: string | null;
}

/** Error que el orquestador debe reintentar (HTTP 500). */
export class StepFailedError extends Error {
  constructor(
    readonly step: string,
    message: string,
  ) {
    super(message);
    this.name = 'StepFailedError';
  }
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate(): Date }).toDate();
  }
  return null;
}

function message(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

function withTimeout<T>(promise: Promise<T>, seconds: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label}: superó ${String(seconds)} s`));
    }, seconds * 1000);
  });
  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

const ILLUSTRATIONS: PipelineStep = 'generate_illustrations';

/**
 * Pipeline del pedido pagado. Cada operación es idempotente y la puede repetir el orquestador:
 * - los eventos se deduplican por `requestId`;
 * - un paso terminado en esta generación no se vuelve a ejecutar;
 * - un paso en curso tiene dueño hasta que vence su lease;
 * - cerrar o fallar una ejecución vieja no toca el pedido.
 */
export class Pipeline {
  constructor(
    private readonly db: Firestore,
    private readonly handlers: PipelineHandlers,
    private readonly orchestrator: Orchestrator,
    private readonly dispatcher: IllustrationDispatcher,
    private readonly log: FastifyBaseLogger,
    private readonly notifier: EmailNotifier | null = null,
  ) {}

  // ------------------------------------------------------------------ eventos

  async handleEvent(event: PipelineEvent): Promise<EventOutcome> {
    const orderRef = this.order(event.orderId);
    const eventRef = orderRef.collection(COLLECTIONS.orderEvents).doc(event.requestId);

    const decision = await this.db.runTransaction(async (tx) => {
      const [orderSnap, eventSnap] = await Promise.all([tx.get(orderRef), tx.get(eventRef)]);
      if (eventSnap.exists) {
        const seen = eventSnap.data() as { started?: boolean; run?: PipelineRun };
        // Si se cayó entre registrar el evento y arrancar, se vuelve a arrancar la misma ejecución.
        return seen.started === false && seen.run
          ? { kind: 'restart' as const, run: seen.run }
          : { kind: 'duplicate' as const };
      }
      if (!orderSnap.exists) return { kind: 'ignored' as const, reason: 'order_not_found' };
      const order = orderSnap.data() as OrderDoc;
      const generation = order.pipeline?.generation ?? 0;

      let from: PipelineStep = PIPELINE_STEPS[0];
      let nextGeneration = generation;
      if (event.type === 'order.paid') {
        if (order.status !== 'paid') {
          return { kind: 'ignored' as const, reason: `status_${order.status}` };
        }
      } else if (event.type === 'order.retry_step') {
        if (order.status !== 'qa_failed') {
          return { kind: 'ignored' as const, reason: `status_${order.status}` };
        }
        from = event.fromStep ?? order.pipeline?.failedStep ?? PIPELINE_STEPS[0];
      } else {
        if (order.status !== 'qa_failed' && order.status !== 'ready') {
          return { kind: 'ignored' as const, reason: `status_${order.status}` };
        }
        nextGeneration = generation + 1;
      }

      assertOrderTransition(order.status, 'generating');
      const run: PipelineRun = {
        orderId: event.orderId,
        runId: randomUUID(),
        generation: nextGeneration,
        steps: stepsFrom(from).map((name) => ({ name, ...STEP_POLICIES[name] })),
      };
      tx.update(orderRef, {
        status: 'generating',
        'pipeline.generation': nextGeneration,
        'pipeline.runId': run.runId,
        'pipeline.startedAt': new Date(),
        'pipeline.finishedAt': null,
        'pipeline.failedStep': null,
        'pipeline.error': null,
        updatedAt: new Date(),
      });
      tx.set(eventRef, { type: event.type, run, started: false, createdAt: new Date() });
      return {
        kind: 'start' as const,
        run,
        resetFrom: event.type === 'order.retry_step' ? from : null,
      };
    });

    if (decision.kind === 'duplicate') return { state: 'duplicate', reason: 'already_processed' };
    if (decision.kind === 'ignored') {
      await eventRef.set({ type: event.type, ignored: decision.reason, createdAt: new Date() });
      this.log.warn(
        { orderId: event.orderId, type: event.type, reason: decision.reason },
        'pipeline event ignored',
      );
      return { state: 'ignored', reason: decision.reason };
    }
    if (decision.kind === 'start' && decision.resetFrom) {
      await this.resetSteps(event.orderId, decision.resetFrom);
    }

    await this.orchestrator.start(decision.run);
    await eventRef.update({ started: true });
    this.log.info(
      { orderId: event.orderId, runId: decision.run.runId, type: event.type },
      'pipeline started',
    );
    return { state: 'started', runId: decision.run.runId };
  }

  /**
   * Reintentar desde un paso: ese y los siguientes vuelven a correr. Si se rehace la historia,
   * también todas las páginas; si se reintentan las ilustraciones, solo las que fallaron.
   */
  private async resetSteps(orderId: string, from: PipelineStep): Promise<void> {
    const steps = this.order(orderId).collection(COLLECTIONS.orderSteps);
    const redoPages = PIPELINE_STEPS.indexOf(from) < PIPELINE_STEPS.indexOf(ILLUSTRATIONS);
    for (const name of stepsFrom(from)) {
      if (name === ILLUSTRATIONS && redoPages) {
        await this.db.recursiveDelete(steps.doc(name));
      } else {
        await steps.doc(name).delete();
      }
    }
  }

  // ------------------------------------------------------------------- pasos

  async runStep(orderId: string, step: PipelineStep, generation: number): Promise<StepOutcome> {
    const orderRef = this.order(orderId);
    const stepRef = orderRef.collection(COLLECTIONS.orderSteps).doc(step);
    const policy = STEP_POLICIES[step];

    const claim = await this.db.runTransaction(async (tx) => {
      const order = await this.current(tx, orderRef, generation);
      if (!order) return { kind: 'stale' as const };
      const snap = await tx.get(stepRef);
      const doc = snap.exists ? (snap.data() as StepDoc) : null;
      const sameGeneration = doc?.generation === generation;
      if (sameGeneration && doc.status === 'succeeded') {
        return { kind: 'done' as const, output: doc.output ?? {} };
      }
      const lease = toDate(doc?.leaseUntil);
      if (sameGeneration && doc.status === 'running' && lease && lease > new Date()) {
        // Ilustraciones repartidas: el paso queda "running" mientras se pintan las páginas.
        return step === ILLUSTRATIONS ? { kind: 'waiting' as const } : { kind: 'busy' as const };
      }
      const now = new Date();
      tx.set(stepRef, {
        name: step,
        status: 'running',
        generation,
        idempotencyKey: stepIdempotencyKey(orderId, generation, step),
        attempts: (sameGeneration ? doc.attempts : 0) + 1,
        startedAt: now,
        finishedAt: null,
        durationMs: null,
        leaseUntil: new Date(now.getTime() + policy.timeoutSeconds * 1000),
        error: null,
        costUsdMicros: 0,
        output: null,
      });
      return { kind: 'claimed' as const, order, startedAt: now };
    });

    if (claim.kind === 'stale') return { state: 'stale' };
    if (claim.kind === 'busy') return { state: 'busy' };
    if (claim.kind === 'done') return { state: 'skipped', output: claim.output };
    if (claim.kind === 'waiting') {
      const status = await this.illustrationStatus(orderId, generation);
      return status.state === 'waiting' ? status : { state: 'busy' };
    }

    const ctx = await this.context(claim.order, orderId, generation, step);
    try {
      if (step === ILLUSTRATIONS) return await this.fanOut(ctx);
      const result = await withTimeout(
        this.handlers.steps[step as SimpleStep](ctx),
        policy.timeoutSeconds,
        step,
      );
      await this.succeed(
        orderRef,
        stepRef,
        claim.startedAt,
        result.output,
        result.costUsdMicros ?? 0,
      );
      return { state: 'succeeded', output: result.output };
    } catch (error) {
      await stepRef.update({
        status: 'failed',
        error: message(error),
        finishedAt: new Date(),
        durationMs: Date.now() - claim.startedAt.getTime(),
        leaseUntil: null,
      });
      this.log.warn({ orderId, step, generation, err: message(error) }, 'pipeline step failed');
      if (error instanceof HumanReviewError)
        return { state: 'human_review', reason: message(error) };
      throw new StepFailedError(step, message(error));
    }
  }

  private async succeed(
    orderRef: DocumentReference,
    stepRef: DocumentReference,
    startedAt: Date,
    output: Record<string, unknown>,
    costUsdMicros: number,
  ): Promise<void> {
    const batch = this.db.batch();
    batch.update(stepRef, {
      status: 'succeeded',
      output,
      costUsdMicros,
      finishedAt: new Date(),
      durationMs: Date.now() - startedAt.getTime(),
      leaseUntil: null,
    });
    if (costUsdMicros > 0) {
      batch.update(orderRef, { 'costsUsdMicros.ai': FieldValue.increment(costUsdMicros) });
    }
    await batch.commit();
  }

  // ------------------------------------------------------------ ilustraciones

  /** Crea una tarea por página y las reparte. Las que ya están pintadas no se repiten. */
  private async fanOut(ctx: StepContext): Promise<StepOutcome> {
    const pages = this.pages(ctx.order.id);
    const total = await this.handlers.planIllustrations(ctx);
    const existing = new Map(
      (await pages.where('generation', '==', ctx.generation).get()).docs.map((doc) => [
        Number(doc.id),
        doc.data() as PageDoc,
      ]),
    );
    const pending: IllustrationTaskRef[] = [];
    const batch = this.db.batch();
    for (let index = 0; index < total; index += 1) {
      const page = existing.get(index);
      if (page?.status === 'succeeded') continue;
      const dispatch = (page?.dispatches ?? 0) + 1;
      pending.push({ orderId: ctx.order.id, generation: ctx.generation, index, dispatch });
      batch.set(pages.doc(String(index)), {
        index,
        generation: ctx.generation,
        status: 'pending',
        attempts: 0,
        dispatches: dispatch,
        error: null,
        costUsdMicros: 0,
        imagePath: null,
      } satisfies PageDoc);
    }
    batch.set(
      this.order(ctx.order.id).collection(COLLECTIONS.orderSteps).doc(ILLUSTRATIONS),
      { output: { total } },
      { merge: true },
    );
    await batch.commit();
    await Promise.all(pending.map((task) => this.dispatcher.dispatch(task)));
    return { state: 'waiting', done: total - pending.length, total };
  }

  /** Pinta una página. Si falla y quedan intentos, lanza el error para que se reintente. */
  async runIllustrationPage(
    orderId: string,
    generation: number,
    index: number,
  ): Promise<'succeeded' | 'failed' | 'skipped'> {
    const orderRef = this.order(orderId);
    const pageRef = this.pages(orderId).doc(String(index));
    const claim = await this.db.runTransaction(async (tx) => {
      const order = await this.current(tx, orderRef, generation);
      const snap = await tx.get(pageRef);
      const page = snap.data() as PageDoc | undefined;
      if (
        !order ||
        page?.generation !== generation ||
        page.status === 'succeeded' ||
        page.status === 'failed'
      ) {
        return null;
      }
      tx.update(pageRef, { status: 'running', attempts: page.attempts + 1 });
      return { order, attempts: page.attempts + 1 };
    });
    if (!claim) return 'skipped';

    const base = await this.context(claim.order, orderId, generation, ILLUSTRATIONS);
    try {
      const result = await withTimeout(
        this.handlers.illustratePage({ ...base, index }),
        ILLUSTRATION_PAGE_POLICY.timeoutSeconds,
        `page ${String(index)}`,
      );
      await pageRef.update({
        status: 'succeeded',
        imagePath: result.imagePath,
        costUsdMicros: result.costUsdMicros ?? 0,
        error: null,
      });
      return 'succeeded';
    } catch (error) {
      const last =
        error instanceof HumanReviewError || claim.attempts >= ILLUSTRATION_PAGE_POLICY.maxAttempts;
      await pageRef.update({ status: last ? 'failed' : 'pending', error: message(error) });
      this.log.warn(
        { orderId, index, attempt: claim.attempts, err: message(error) },
        'illustration failed',
      );
      if (last) return 'failed';
      throw new StepFailedError(ILLUSTRATIONS, message(error));
    }
  }

  /** Estado de las páginas; cuando terminan todas, cierra el paso (o lo marca fallido). */
  async illustrationStatus(orderId: string, generation: number): Promise<IllustrationStatus> {
    const orderRef = this.order(orderId);
    const stepRef = orderRef.collection(COLLECTIONS.orderSteps).doc(ILLUSTRATIONS);
    const [orderSnap, stepSnap, pagesSnap] = await Promise.all([
      orderRef.get(),
      stepRef.get(),
      this.pages(orderId).where('generation', '==', generation).get(),
    ]);
    const order = orderSnap.data() as OrderDoc | undefined;
    if (order?.status !== 'generating' || (order.pipeline?.generation ?? 0) !== generation) {
      return { state: 'stale' };
    }
    const step = stepSnap.data() as StepDoc | undefined;
    if (step?.generation === generation && step.status === 'succeeded')
      return { state: 'succeeded' };
    const planned = step?.output?.total;
    const total = typeof planned === 'number' ? planned : pagesSnap.size;
    const pages = pagesSnap.docs.map((doc) => doc.data() as PageDoc);
    const failed = pages.filter((page) => page.status === 'failed');
    if (failed.length > 0) {
      const error = `${String(failed.length)} página(s) sin ilustrar: ${failed[0]?.error ?? ''}`;
      await stepRef.update({ status: 'failed', error, finishedAt: new Date(), leaseUntil: null });
      return { state: 'failed', error };
    }
    const done = pages.filter((page) => page.status === 'succeeded');
    if (done.length < total) return { state: 'waiting', done: done.length, total };

    const cost = done.reduce((sum, page) => sum + page.costUsdMicros, 0);
    const images = done
      .sort((a, b) => a.index - b.index)
      .map((page) => ({ index: page.index, imagePath: page.imagePath }));
    await this.succeed(
      orderRef,
      stepRef,
      toDate(step?.startedAt) ?? new Date(),
      { total, images },
      cost,
    );
    return { state: 'succeeded' };
  }

  // ------------------------------------------------------------- cierre

  /** Fin feliz: el libro queda listo. Una ejecución vieja no cambia nada. */
  async finish(orderId: string, runId: string): Promise<boolean> {
    // Si la entrega mandó el libro a la imprenta, el pedido queda "en imprenta".
    const deliver = (
      await this.order(orderId).collection(COLLECTIONS.orderSteps).doc('deliver').get()
    ).data() as { output?: { sentToPrint?: boolean } } | undefined;
    const to = deliver?.output?.sentToPrint ? 'sent_to_print' : 'ready';
    const closed = await this.close(orderId, runId, to, {});
    if (closed) await this.notifier?.orderStatus(orderId, to);
    return closed;
  }

  /** Se agotaron los reintentos: revisión manual y aviso al admin. */
  async fail(orderId: string, runId: string, step: PipelineStep, error: string): Promise<boolean> {
    const closed = await this.close(orderId, runId, 'qa_failed', {
      'pipeline.failedStep': step,
      'pipeline.error': error.slice(0, 500),
    });
    if (closed) {
      await this.db.collection(COLLECTIONS.adminAlerts).add({
        kind: 'pipeline_failed',
        orderId,
        step,
        message: error.slice(0, 500),
        createdAt: new Date(),
        resolvedAt: null,
      });
      // severity ERROR: la alerta de Cloud Monitoring (fase 16) se dispara con este log.
      this.log.error({ orderId, step, runId, err: error }, 'pipeline failed: manual review');
      await this.notifier?.adminAlert({
        key: `alert:${orderId}:pipeline_failed:${runId}`,
        kind: 'pipeline_failed',
        orderId,
        message: `Revisión manual (${step}): ${error.slice(0, 300)}`,
      });
    }
    return closed;
  }

  private async close(
    orderId: string,
    runId: string,
    to: 'ready' | 'qa_failed' | 'sent_to_print',
    extra: Record<string, unknown>,
  ): Promise<boolean> {
    const orderRef = this.order(orderId);
    return this.db.runTransaction(async (tx) => {
      const order = (await tx.get(orderRef)).data() as OrderDoc | undefined;
      if (order?.status !== 'generating' || order.pipeline?.runId !== runId) return false;
      // A imprenta se llega pasando por "listo".
      if (to === 'sent_to_print') {
        assertOrderTransition(order.status, 'ready');
        assertOrderTransition('ready', to);
      } else {
        assertOrderTransition(order.status, to);
      }
      tx.update(orderRef, {
        status: to,
        'pipeline.finishedAt': new Date(),
        ...extra,
        updatedAt: new Date(),
      });
      return true;
    });
  }

  // ------------------------------------------------------------ utilidades

  private order(orderId: string) {
    return this.db.collection(COLLECTIONS.orders).doc(orderId);
  }

  private pages(orderId: string) {
    return this.order(orderId)
      .collection(COLLECTIONS.orderSteps)
      .doc(ILLUSTRATIONS)
      .collection(COLLECTIONS.illustrationTasks);
  }

  /** El pedido, solo si sigue generando esta generación. */
  private async current(
    tx: Transaction,
    orderRef: DocumentReference,
    generation: number,
  ): Promise<PipelineOrder | null> {
    const snap = await tx.get(orderRef);
    const order = snap.data() as OrderDoc | undefined;
    if (order?.status !== 'generating' || (order.pipeline?.generation ?? 0) !== generation) {
      return null;
    }
    return {
      id: snap.id,
      ownerUid: order.ownerUid,
      bookId: order.bookId,
      status: order.status,
      channel: order.channel ?? 'families',
      items: order.items ?? [],
      sourceOrderId: order.sourceOrderId ?? null,
    };
  }

  private async context(
    order: PipelineOrder,
    orderId: string,
    generation: number,
    step: PipelineStep,
  ): Promise<StepContext> {
    const snaps = await this.order(orderId).collection(COLLECTIONS.orderSteps).get();
    const outputs: StepOutputs = {};
    for (const doc of snaps.docs) {
      const data = doc.data() as StepDoc;
      if (data.generation === generation && data.status === 'succeeded' && data.output) {
        outputs[doc.id as PipelineStep] = data.output;
      }
    }
    return {
      order,
      generation,
      idempotencyKey: stepIdempotencyKey(orderId, generation, step),
      outputs,
      log: this.log,
    };
  }
}
