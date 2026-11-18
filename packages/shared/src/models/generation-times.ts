import { PIPELINE_STEPS, type PipelineStep } from './pipeline';

/**
 * Registro de cuánto tarda cada tipo de generación con IA, para decirle a la persona cuánto
 * falta («Suele tardar unos 2 minutos») y mover una barra de avance que no miente.
 *
 * Cada vez que una generación sale bien, el servidor guarda su duración en
 * `generationTimings/{tipo}` (las últimas MAX_SAMPLES). El estimado es la mediana; «tarda más de
 * lo normal» se dice pasado el percentil 80. Con menos de MIN_SAMPLES se usan los valores de
 * abajo (DECISIONS 262).
 */
export const GENERATION_KINDS = [
  /** Escribir el cuento y dibujar la lámina del personaje (muestra con foto o rasgos). */
  'preview',
  /** Escribir el cuento con el dibujo guardado del personaje (sin lámina para aprobar). */
  'preview_story',
  /** Portada y primeras páginas de la muestra, una vez aprobado el personaje. */
  'illustrate',
  /** «Corregir rasgos»: volver a dibujar la lámina. */
  'character_fix',
  /** Regenerar una ilustración de la muestra (portada o página). */
  'regenerate',
  /** Dibujo del personaje desde su perfil (sin cuento). */
  'child_drawing',
  /** Libro completo, del pago a listo. */
  'book',
  ...PIPELINE_STEPS.map((step) => `book_${step}` as const),
] as const;

export type GenerationKind = (typeof GENERATION_KINDS)[number];

export const bookStepKind = (step: PipelineStep): GenerationKind => `book_${step}`;

/** Cuántas duraciones se guardan por tipo (las más nuevas). */
export const MAX_SAMPLES = 50;
/** Con menos muestras reales que estas, manda el valor por defecto. */
export const MIN_SAMPLES = 3;
/** Fuera de este rango la duración se descarta (reloj raro, pedido trabado y retomado). */
const MIN_SECONDS = 1;
const MAX_SECONDS = 3 * 60 * 60;

/**
 * Valores de partida (segundos: típico y lento). Muestra: tiempos reales de staging 24/10–05/11
 * (n=16, mediana 106 s, p90 148 s; ilustrar n=7, mediana 55 s). El resto, prudentes hasta que
 * haya datos: el registro los reemplaza solo.
 */
export const DEFAULT_GENERATION_TIMES: Record<GenerationKind, GenerationEstimate> = {
  preview: { typicalSeconds: 110, slowSeconds: 150, samples: 0 },
  preview_story: { typicalSeconds: 60, slowSeconds: 90, samples: 0 },
  illustrate: { typicalSeconds: 55, slowSeconds: 75, samples: 0 },
  character_fix: { typicalSeconds: 45, slowSeconds: 70, samples: 0 },
  regenerate: { typicalSeconds: 40, slowSeconds: 60, samples: 0 },
  child_drawing: { typicalSeconds: 45, slowSeconds: 70, samples: 0 },
  book: { typicalSeconds: 900, slowSeconds: 1500, samples: 0 },
  book_prepare_photo: { typicalSeconds: 15, slowSeconds: 30, samples: 0 },
  book_generate_story: { typicalSeconds: 90, slowSeconds: 150, samples: 0 },
  book_generate_illustrations: { typicalSeconds: 420, slowSeconds: 720, samples: 0 },
  book_quality_check: { typicalSeconds: 300, slowSeconds: 600, samples: 0 },
  book_layout_pdf: { typicalSeconds: 60, slowSeconds: 120, samples: 0 },
  book_deliver: { typicalSeconds: 10, slowSeconds: 30, samples: 0 },
};

export interface GenerationEstimate {
  /** Mediana de las últimas duraciones (o el valor por defecto). */
  typicalSeconds: number;
  /** Percentil 80: pasado esto, «está tardando un poco más de lo normal». */
  slowSeconds: number;
  /** Cuántas duraciones reales hay detrás (0 = valor por defecto). */
  samples: number;
}

export type GenerationTimes = Record<GenerationKind, GenerationEstimate>;

/** generationTimings/{tipo}: últimas duraciones en segundos, la más nueva al final. */
export interface GenerationTimingDoc {
  kind: GenerationKind;
  samples: number[];
  updatedAt: Date;
}

export function isGenerationKind(value: string): value is GenerationKind {
  return (GENERATION_KINDS as readonly string[]).includes(value);
}

/** Suma una duración a la lista (descarta las absurdas y conserva las MAX_SAMPLES más nuevas). */
export function addSample(samples: readonly number[] | undefined, durationMs: number): number[] {
  const list = (samples ?? []).filter((value) => Number.isFinite(value));
  const seconds = Math.round(durationMs / 100) / 10;
  if (!Number.isFinite(seconds) || seconds < MIN_SECONDS || seconds > MAX_SECONDS) return list;
  return [...list, seconds].slice(-MAX_SAMPLES);
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  const lowValue = sorted[low] ?? 0;
  const highValue = sorted[high] ?? lowValue;
  return lowValue + (highValue - lowValue) * (position - low);
}

/** Estimado de un tipo: con pocas muestras manda el valor por defecto. */
export function summarizeSamples(
  kind: GenerationKind,
  samples: readonly number[] | undefined,
): GenerationEstimate {
  const list = [...(samples ?? [])].filter((value) => Number.isFinite(value) && value > 0);
  if (list.length < MIN_SAMPLES) {
    return { ...DEFAULT_GENERATION_TIMES[kind], samples: list.length };
  }
  list.sort((a, b) => a - b);
  const typical = Math.max(1, Math.round(quantile(list, 0.5)));
  const slow = Math.max(typical, Math.round(quantile(list, 0.8)));
  return { typicalSeconds: typical, slowSeconds: slow, samples: list.length };
}

/** Todos los tipos, con lo que haya guardado (lo que falta, por defecto). */
export function generationTimesFrom(
  docs: readonly { kind: string; samples?: readonly number[] }[],
): GenerationTimes {
  const byKind = new Map(docs.map((doc) => [doc.kind, doc.samples]));
  return Object.fromEntries(
    GENERATION_KINDS.map((kind) => [kind, summarizeSamples(kind, byKind.get(kind))]),
  ) as GenerationTimes;
}

/**
 * Avance según el tiempo: llega al 90 % en el tiempo típico y después se acerca despacio al
 * 98 %, sin llegar nunca al final (eso lo marca que termine de verdad) ni ir para atrás.
 */
export function timeProgress(elapsedMs: number, typicalSeconds: number): number {
  if (typicalSeconds <= 0 || elapsedMs <= 0) return 0;
  const ratio = elapsedMs / (typicalSeconds * 1000);
  if (ratio <= 1) return 0.9 * ratio;
  return 0.9 + 0.08 * (1 - Math.exp(-(ratio - 1) * 1.5));
}

/**
 * Minutos que quedan, redondeados para leer cómodo (nunca segundos que corren). `null` si ya pasó
 * el tiempo típico: ahí se dice «falta poco» o «tarda más de lo normal».
 */
export function remainingMinutes(elapsedMs: number, typicalSeconds: number): number | null {
  const left = typicalSeconds - elapsedMs / 1000;
  if (left <= 0) return null;
  return Math.max(1, Math.ceil(left / 60));
}

/** Etapas del libro completo que ve quien compra. */
export const BOOK_PROGRESS_STAGES = ['story', 'illustrations', 'review', 'layout'] as const;
export type BookProgressStage = (typeof BOOK_PROGRESS_STAGES)[number];

const STAGE_OF_STEP: Record<PipelineStep, BookProgressStage> = {
  prepare_photo: 'story',
  generate_story: 'story',
  generate_illustrations: 'illustrations',
  quality_check: 'review',
  layout_pdf: 'layout',
  deliver: 'layout',
};

export interface BookStepState {
  name: PipelineStep;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  startedAt: Date | null;
}

export interface BookProgress {
  /** 0 a 1. */
  fraction: number;
  stage: BookProgressStage;
  /** Páginas ilustradas (solo mientras se ilustra). */
  pagesDone: number | null;
  pagesTotal: number | null;
  /** Segundos que faltan según los tiempos típicos (0 si ya debería estar). */
  remainingSeconds: number;
  /** Ya pasó el tiempo lento de todo el libro. */
  late: boolean;
}

/**
 * Avance del libro completo: cada paso pesa lo que suele tardar. Los terminados cuentan
 * enteros; el que corre, por sus páginas pintadas (ilustraciones) o por el tiempo.
 */
export function bookProgress(input: {
  steps: readonly BookStepState[];
  pages: { done: number; total: number } | null;
  times: GenerationTimes;
  startedAt: Date | null;
  now: Date;
}): BookProgress {
  const { steps, pages, times, now } = input;
  const byName = new Map(steps.map((step) => [step.name, step]));
  const weight = (step: PipelineStep) => times[bookStepKind(step)].typicalSeconds;
  const total = PIPELINE_STEPS.reduce((sum, step) => sum + weight(step), 0);
  let done = 0;
  let remaining = 0;
  let stage: BookProgressStage = 'story';
  let current: PipelineStep | null = null;
  for (const step of PIPELINE_STEPS) {
    const state = byName.get(step);
    const finished = state?.status === 'succeeded' || state?.status === 'skipped';
    if (finished) {
      done += weight(step);
      continue;
    }
    if (current === null) {
      current = step;
      stage = STAGE_OF_STEP[step];
      const elapsed = state?.startedAt ? now.getTime() - state.startedAt.getTime() : 0;
      const running = state?.status === 'running';
      let part = running ? timeProgress(elapsed, weight(step)) : 0;
      if (step === 'generate_illustrations' && pages && pages.total > 0) {
        part = Math.max(part * 0.3, Math.min(pages.done / pages.total, 0.98));
      }
      done += weight(step) * part;
      remaining += weight(step) * (1 - part);
    } else {
      remaining += weight(step);
    }
  }
  const fraction = total > 0 ? Math.min(done / total, 0.99) : 0;
  const elapsedAll = input.startedAt ? (now.getTime() - input.startedAt.getTime()) / 1000 : 0;
  return {
    fraction,
    stage,
    pagesDone: current === 'generate_illustrations' && pages ? pages.done : null,
    pagesTotal: current === 'generate_illustrations' && pages ? pages.total : null,
    remainingSeconds: Math.round(remaining),
    late: elapsedAll > times.book.slowSeconds,
  };
}
