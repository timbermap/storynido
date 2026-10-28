import { traceLogFields } from '@storynido/shared/server';
import { pipelineEventSchema, pipelineStepSchema } from '@storynido/shared';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { z } from 'zod';

import type { PostSaleJobs } from './jobs/post-sale';
import { StepFailedError, type Pipeline } from './pipeline/pipeline';

export interface AppOptions {
  logger?: FastifyServerOptions['logger'];
  version: string;
  /** Vigía del pipeline (pedidos atascados). */
  watchdog?: () => { run(): Promise<unknown> };
  /** Proyecto de Google Cloud (para unir los logs con sus trazas). */
  projectId?: string;
  /** Sin pipeline solo responde el health check. Es una función: se crea con el logger de la app. */
  pipeline?: () => Pipeline;
  /** Postventa diaria (Cloud Scheduler). */
  jobs?: () => PostSaleJobs;
}

const runBody = z.object({
  orderId: z.string().min(1),
  generation: z.number().int().nonnegative(),
});
const pageBody = runBody.extend({ index: z.number().int().nonnegative() });
const closeBody = z.object({ runId: z.string().min(1) });
const failBody = closeBody.extend({ step: pipelineStepSchema, error: z.string().max(2000) });
const pubsubEnvelope = z.object({
  message: z.object({ data: z.string(), messageId: z.string().optional() }),
});

/**
 * Worker del pipeline. No es público: Cloud Run solo acepta llamadas con OIDC de las cuentas
 * invocadoras (Pub/Sub, Cloud Tasks y Cloud Workflows). En local escucha en localhost.
 */
export function buildApp({
  logger = false,
  version,
  pipeline,
  jobs,
  watchdog,
  projectId,
}: AppOptions) {
  const app = Fastify({ logger });

  // Cada línea de log del request lleva su traza (Cloud Run la manda en la cabecera; los pasos de
  // un pedido llegan todos con la traza del pedido).
  app.addHook('onRequest', (request, _reply, done) => {
    const header = request.headers['x-cloud-trace-context'] ?? request.headers.traceparent;
    const fields = traceLogFields(Array.isArray(header) ? header[0] : header, projectId ?? 'local');
    if (Object.keys(fields).length > 0) request.log = request.log.child(fields);
    done();
  });

  // Cloud Run reserva las rutas que terminan en "z" (p. ej. /healthz), por eso se usa /health.
  app.get('/health', () => ({ status: 'ok', service: 'worker', version }));

  /** Postventa: reseñas, recordatorios, sugerencias y reintentos de mails (una vez por día). */
  if (jobs) app.post('/jobs/daily', () => jobs().run());
  /** Vigía: pedidos atascados generando (cada 30 minutos). */
  if (watchdog) app.post('/jobs/watchdog', () => watchdog().run());

  if (!pipeline) return app;

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ error: 'bad_request', issues: error.issues });
    }
    // Un paso que falla responde 500: Workflows, Cloud Tasks o Pub/Sub lo reintentan.
    if (!(error instanceof StepFailedError)) request.log.error({ err: error }, 'worker error');
    return reply.status(500).send({ error: error instanceof Error ? error.message : 'error' });
  });

  /** Evento directo (desarrollo local: la API llama al worker sin Pub/Sub). */
  app.post('/events', async (request) =>
    pipeline().handleEvent(pipelineEventSchema.parse(request.body)),
  );

  /** Suscripción push de Pub/Sub al tema `order-events`. */
  app.post('/events/pubsub', async (request, reply) => {
    const envelope = pubsubEnvelope.safeParse(request.body);
    const event = envelope.success
      ? pipelineEventSchema.safeParse(
          JSON.parse(Buffer.from(envelope.data.message.data, 'base64').toString('utf8')),
        )
      : null;
    if (!event?.success) {
      // Un mensaje mal formado no se arregla reintentando: se confirma y queda en el log.
      request.log.error({ body: request.body }, 'invalid pipeline event');
      return reply.status(204).send();
    }
    return pipeline().handleEvent(event.data);
  });

  app.post('/pipeline/steps/:step/run', async (request) => {
    const step = pipelineStepSchema.parse((request.params as { step: string }).step);
    const body = runBody.parse(request.body);
    return pipeline().runStep(body.orderId, step, body.generation);
  });

  app.post('/pipeline/illustrations/status', async (request) => {
    const body = runBody.parse(request.body);
    return pipeline().illustrationStatus(body.orderId, body.generation);
  });

  /** Tarea de Cloud Tasks: una página. */
  app.post('/pipeline/illustrations/run', async (request) => {
    const body = pageBody.parse(request.body);
    return {
      state: await pipeline().runIllustrationPage(body.orderId, body.generation, body.index),
    };
  });

  app.post('/pipeline/orders/:orderId/finish', async (request) => {
    const { orderId } = request.params as { orderId: string };
    const body = closeBody.parse(request.body);
    return { closed: await pipeline().finish(orderId, body.runId) };
  });

  app.post('/pipeline/orders/:orderId/fail', async (request) => {
    const { orderId } = request.params as { orderId: string };
    const body = failBody.parse(request.body);
    return { closed: await pipeline().fail(orderId, body.runId, body.step, body.error) };
  });

  return app;
}
