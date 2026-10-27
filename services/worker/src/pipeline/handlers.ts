import type { PipelineStep } from '@storynido/shared';
import type { FastifyBaseLogger } from 'fastify';

/** Pedido tal como lo lee el pipeline (solo los campos que usa). */
export interface PipelineOrder {
  id: string;
  ownerUid: string;
  bookId: string;
  status: string;
  channel: string;
  items: { piece: string; format: string; quantity: number }[];
}

export type StepOutputs = Partial<Record<PipelineStep, Record<string, unknown>>>;

export interface StepContext {
  order: PipelineOrder;
  generation: number;
  /** Igual en todos los reintentos del paso: los proveedores la usan para no duplicar. */
  idempotencyKey: string;
  /** Resultados de los pasos anteriores de esta generación. */
  outputs: StepOutputs;
  log: FastifyBaseLogger;
}

export interface StepResult {
  output: Record<string, unknown>;
  costUsdMicros?: number;
}

export interface PageContext extends StepContext {
  index: number;
}

export interface PageResult {
  imagePath: string;
  costUsdMicros?: number;
}

export type SimpleStep = Exclude<PipelineStep, 'generate_illustrations'>;

/**
 * Un problema que reintentar no arregla (rasgo crítico distinto, texto aprobado con error,
 * contenido bloqueado): el pedido va directo a revisión manual, sin gastar más intentos.
 */
export class HumanReviewError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HumanReviewError';
  }
}

/** Lo que hace cada paso. La orquestación (reintentos, idempotencia, registro) es aparte. */
export interface PipelineHandlers {
  steps: Record<SimpleStep, (ctx: StepContext) => Promise<StepResult>>;
  /** Cuántas imágenes lleva el libro (portada + páginas ilustradas). */
  planIllustrations(ctx: StepContext): Promise<number>;
  illustratePage(ctx: PageContext): Promise<PageResult>;
}

/**
 * Pasos simulados (fase 08): recorren el pipeline completo sin IA ni costos. La fase 09 los
 * reemplaza por la generación real; la fase 10 por el PDF y la 12 por la entrega.
 */
export function simulatedHandlers(): PipelineHandlers {
  const base = (ctx: StepContext) => `orders/${ctx.order.id}/g${String(ctx.generation)}`;
  return {
    steps: {
      prepare_photo: () => Promise.resolve({ output: { simulated: true } }),
      generate_story: () => Promise.resolve({ output: { simulated: true, pages: 4 } }),
      quality_check: () => Promise.resolve({ output: { simulated: true, issues: 0 } }),
      layout_pdf: (ctx) =>
        Promise.resolve({ output: { simulated: true, pdfPath: `${base(ctx)}/book.pdf` } }),
      deliver: (ctx) =>
        Promise.resolve({
          output: {
            simulated: true,
            copies: ctx.order.items.reduce((sum, item) => sum + item.quantity, 0),
          },
        }),
    },
    planIllustrations: (ctx) => {
      const pages = Number(ctx.outputs.generate_story?.pages ?? 0);
      // Portada + cada página del cuento.
      return Promise.resolve(1 + pages);
    },
    illustratePage: (ctx) =>
      Promise.resolve({ imagePath: `${base(ctx)}/page-${String(ctx.index)}.webp` }),
  };
}
