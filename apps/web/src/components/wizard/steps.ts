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
  // Celebraciones (DECISIONS 223). Van al final: el índice de los anteriores no cambia.
  'party',
  'kit',
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

/**
 * Pasos de cada línea, en orden (config declarativa: un solo asistente para las tres). Cambiar
 * el orden o quitar un paso no rompe borradores: se guarda el nombre del paso, no su posición.
 */
export const FLOWS: Record<Channel, readonly WizardStep[]> = {
  // El personaje primero (DECISIONS 159): quien lo crea ve a su hijo dibujado en el primer minuto y
  // todo lo demás (historias, lectura, estilo) se ajusta a su edad. Después la aventura y los ajustes.
  families: ['child', 'photos', 'story', 'lesson', 'memories', 'style', 'review'],
  // El cumpleañero y su personaje, la fiesta y qué lleva: la historia y el estilo salen de la temática.
  events: ['child', 'photos', 'party', 'kit', 'review'],
  // El paciente (alias) y su personaje; después la historia de la colección y su objetivo.
  professionals: ['child', 'photos', 'story', 'lesson', 'memories', 'style', 'review'],
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
  { key: 'character', steps: ['child', 'photos'] },
  { key: 'adventure', steps: ['story', 'party'] },
  { key: 'settings', steps: ['lesson', 'memories', 'style', 'kit'] },
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
