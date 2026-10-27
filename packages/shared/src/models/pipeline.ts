import { z } from 'zod';

/** Pasos del pipeline del libro, en orden. */
export const PIPELINE_STEPS = [
  'prepare_photo',
  'generate_story',
  'generate_illustrations',
  'quality_check',
  'layout_pdf',
  'deliver',
] as const;

export const pipelineStepSchema = z.enum(PIPELINE_STEPS);

export type PipelineStep = z.infer<typeof pipelineStepSchema>;

export interface StepPolicy {
  /** Intentos totales (el primero más los reintentos). */
  maxAttempts: number;
  /** Tiempo máximo de un intento; después se da por perdido y otro intento puede tomarlo. */
  timeoutSeconds: number;
}

/** Reintentos y timeouts por paso. La misma política usa Cloud Workflows (infra) y el orquestador local. */
export const STEP_POLICIES: Record<PipelineStep, StepPolicy> = {
  prepare_photo: { maxAttempts: 3, timeoutSeconds: 120 },
  generate_story: { maxAttempts: 3, timeoutSeconds: 300 },
  generate_illustrations: { maxAttempts: 2, timeoutSeconds: 1800 },
  quality_check: { maxAttempts: 3, timeoutSeconds: 600 },
  layout_pdf: { maxAttempts: 3, timeoutSeconds: 600 },
  deliver: { maxAttempts: 5, timeoutSeconds: 120 },
};

/** Intentos por página ilustrada (cada página es una tarea propia). */
export const ILLUSTRATION_PAGE_POLICY: StepPolicy = { maxAttempts: 4, timeoutSeconds: 300 };

/** Espera antes del reintento `attempt` (1, 2, 3…): exponencial con tope. */
export function retryDelayMs(attempt: number, baseMs = 2000, maxMs = 60_000): number {
  return Math.min(baseMs * 2 ** Math.max(attempt - 1, 0), maxMs);
}

/** Pasos desde `from` (incluido) hasta el final. */
export function stepsFrom(from: PipelineStep): PipelineStep[] {
  return PIPELINE_STEPS.slice(PIPELINE_STEPS.indexOf(from));
}

/**
 * Clave idempotente de un paso: la misma para todos los reintentos de una generación. Regenerar
 * el libro sube la generación y cambia las claves; reintentar un paso no.
 */
export function stepIdempotencyKey(orderId: string, generation: number, step: string): string {
  return `${orderId}:g${String(generation)}:${step}`;
}

export const STEP_STATUSES = ['pending', 'running', 'succeeded', 'failed', 'skipped'] as const;

/** orders/{orderId}/steps/{step}: historial del pipeline. Solo servidor. */
export const orderStepSchema = z.object({
  name: pipelineStepSchema,
  status: z.enum(STEP_STATUSES),
  generation: z.number().int().nonnegative(),
  idempotencyKey: z.string(),
  attempts: z.number().int().nonnegative(),
  startedAt: z.date().nullable(),
  finishedAt: z.date().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  /** Mientras corre: hasta cuándo es dueño el intento actual (después otro intento lo retoma). */
  leaseUntil: z.date().nullable(),
  error: z.string().nullable(),
  /** Costo del paso en millonésimas de dólar (IA, imprenta, envío). */
  costUsdMicros: z.number().int().nonnegative(),
  /** Resultado que necesitan los pasos siguientes (rutas, conteos); nunca datos del niño. */
  output: z.record(z.string(), z.unknown()).nullable(),
});

export type OrderStep = z.infer<typeof orderStepSchema>;

/** orders/{orderId}/steps/generate_illustrations/pages/{index}: una tarea por página. */
export const illustrationTaskSchema = z.object({
  index: z.number().int().nonnegative(),
  generation: z.number().int().nonnegative(),
  status: z.enum(['pending', 'running', 'succeeded', 'failed']),
  attempts: z.number().int().nonnegative(),
  error: z.string().nullable(),
  costUsdMicros: z.number().int().nonnegative(),
  imagePath: z.string().nullable(),
});

export type IllustrationTask = z.infer<typeof illustrationTaskSchema>;

/** Estado del pipeline guardado en el pedido. */
export const orderPipelineSchema = z.object({
  /** Sube con cada "regenerar el libro completo". */
  generation: z.number().int().nonnegative(),
  /** Ejecución en curso (Cloud Workflows o el orquestador local). */
  runId: z.string().nullable(),
  startedAt: z.date().nullable(),
  finishedAt: z.date().nullable(),
  failedStep: pipelineStepSchema.nullable(),
  error: z.string().nullable(),
});

export type OrderPipeline = z.infer<typeof orderPipelineSchema>;

export const PIPELINE_EVENT_TYPES = ['order.paid', 'order.retry_step', 'order.regenerate'] as const;

/**
 * Evento que pone en marcha el pipeline (tema de Pub/Sub `order-events`). `requestId` lo
 * deduplica: el mismo evento entregado dos veces no hace nada la segunda vez.
 */
export const pipelineEventSchema = z.object({
  type: z.enum(PIPELINE_EVENT_TYPES),
  orderId: z.string().min(1),
  requestId: z.string().min(1).max(200),
  /** Solo en order.retry_step: desde qué paso se vuelve a correr. */
  fromStep: pipelineStepSchema.optional(),
});

export type PipelineEvent = z.infer<typeof pipelineEventSchema>;

/** adminAlerts/{id}: avisos para el admin (pedido trabado, paso agotado). Solo servidor. */
export const adminAlertSchema = z.object({
  kind: z.enum(['pipeline_failed']),
  orderId: z.string(),
  step: pipelineStepSchema.nullable(),
  message: z.string(),
  createdAt: z.date(),
  resolvedAt: z.date().nullable(),
});

export type AdminAlert = z.infer<typeof adminAlertSchema>;
