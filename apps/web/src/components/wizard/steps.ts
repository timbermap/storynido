import type { Channel } from '@storynido/shared';

/**
 * Todos los pasos que existen. El orden de cada línea lo define FLOWS; esta lista es además el
 * índice histórico (`wizardStep`) con el que se guardaban los borradores antes de DECISIONS 113.
 */
export const WIZARD_STEPS = [
  'child',
  'photos',
  'story',
  'memories',
  'lesson',
  'style',
  'review',
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

/**
 * Pasos de cada línea, en orden (config declarativa: un solo asistente para las tres). Cambiar
 * el orden o quitar un paso no rompe borradores: se guarda el nombre del paso, no su posición.
 */
export const FLOWS: Record<Channel, readonly WizardStep[]> = {
  // Arranque propio (historia y enseñanza), núcleo compartido (protagonista y personaje con su
  // estilo) y la muestra (DECISIONS 116).
  families: ['story', 'lesson', 'child', 'memories', 'photos', 'style', 'review'],
  // Primero la celebración (ocasión, fecha, temática y una sola edad); sin enseñanza particular.
  events: ['child', 'memories', 'story', 'photos', 'style', 'review'],
  // La historia de la colección y su objetivo; después el proyecto (alias) y el personaje.
  professionals: ['story', 'lesson', 'child', 'memories', 'photos', 'style', 'review'],
};

export const flowFor = (channel: Channel): readonly WizardStep[] => FLOWS[channel];

const isStep = (value: unknown): value is WizardStep =>
  typeof value === 'string' && (WIZARD_STEPS as readonly string[]).includes(value);

/**
 * Hasta dónde llegó el borrador, como posición en el flujo de su línea. Lee `wizardStepKey`; en
 * borradores anteriores (o con un paso que la línea ya no tiene) se toma como completado todo lo
 * que venía antes en el orden histórico, y se retoma en el primer paso del flujo que falta.
 */
export function reachedIndex(
  flow: readonly WizardStep[],
  book: { wizardStepKey?: string | null; wizardStep: number },
): number {
  if (isStep(book.wizardStepKey) && flow.includes(book.wizardStepKey)) {
    return flow.indexOf(book.wizardStepKey);
  }
  const key = isStep(book.wizardStepKey) ? book.wizardStepKey : WIZARD_STEPS[book.wizardStep];
  if (!key) return 0;
  const done = WIZARD_STEPS.slice(0, WIZARD_STEPS.indexOf(key));
  const pending = flow.findIndex((step) => !done.includes(step));
  return pending < 0 ? flow.length - 1 : pending;
}

/**
 * Las 4 etapas que ve el cliente (AUDITORIA-PRODUCTO §2). Cada línea las recorre en el orden de
 * su flujo (`stagesFor`). Recuerdos y enseñanza son opcionales.
 */
export const WIZARD_STAGES = [
  { key: 'adventure', steps: ['story', 'lesson'] },
  { key: 'child', steps: ['child', 'memories'] },
  { key: 'character', steps: ['photos', 'style'] },
  { key: 'preview', steps: ['review'] },
] as const satisfies readonly { key: string; steps: readonly WizardStep[] }[];

/** Las etapas en el orden en que las recorre el flujo de una línea. */
export function stagesFor(flow: readonly WizardStep[]) {
  return [...WIZARD_STAGES].sort(
    (a, b) =>
      Math.min(...a.steps.map((step) => flowIndex(flow, step))) -
      Math.min(...b.steps.map((step) => flowIndex(flow, step))),
  );
}

const flowIndex = (flow: readonly WizardStep[], step: WizardStep) => {
  const index = flow.indexOf(step);
  return index < 0 ? Number.POSITIVE_INFINITY : index;
};

export type WizardStage = (typeof WIZARD_STAGES)[number]['key'];

export function stageOf(step: WizardStep) {
  const index = WIZARD_STAGES.findIndex((stage) =>
    (stage.steps as readonly WizardStep[]).includes(step),
  );
  return { index, stage: WIZARD_STAGES[index] ?? WIZARD_STAGES[0] };
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
