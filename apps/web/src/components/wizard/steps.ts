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
  families: ['child', 'photos', 'story', 'memories', 'lesson', 'style', 'review'],
  // Un cuento para todos los invitados: sin enseñanza particular.
  events: ['child', 'photos', 'story', 'memories', 'style', 'review'],
  professionals: ['child', 'photos', 'story', 'memories', 'lesson', 'style', 'review'],
};

export const flowFor = (channel: Channel): readonly WizardStep[] => FLOWS[channel];

const isStep = (value: unknown): value is WizardStep =>
  typeof value === 'string' && (WIZARD_STEPS as readonly string[]).includes(value);

/**
 * Hasta dónde llegó el borrador, como posición en el flujo de su línea. Lee `wizardStepKey` y,
 * en borradores anteriores, traduce el índice viejo (`wizardStep`) a su paso. Un paso que la
 * línea ya no tiene cuenta como el anterior que sí está.
 */
export function reachedIndex(
  flow: readonly WizardStep[],
  book: { wizardStepKey?: string | null; wizardStep: number },
): number {
  const key = isStep(book.wizardStepKey) ? book.wizardStepKey : WIZARD_STEPS[book.wizardStep];
  if (!key) return 0;
  const direct = flow.indexOf(key);
  if (direct >= 0) return direct;
  const global = WIZARD_STEPS.indexOf(key);
  let best = 0;
  flow.forEach((step, index) => {
    if (WIZARD_STEPS.indexOf(step) <= global) best = index;
  });
  return best;
}

/**
 * Las 4 etapas que ve el cliente (AUDITORIA-PRODUCTO §2): agrupan los pasos sin cambiar su orden.
 * Recuerdos y enseñanza son opcionales dentro de "La aventura".
 */
export const WIZARD_STAGES = [
  { key: 'child', steps: ['child'] },
  { key: 'character', steps: ['photos'] },
  { key: 'adventure', steps: ['story', 'memories', 'lesson', 'style'] },
  { key: 'preview', steps: ['review'] },
] as const satisfies readonly { key: string; steps: readonly WizardStep[] }[];

export type WizardStage = (typeof WIZARD_STAGES)[number]['key'];

export function stageOf(step: WizardStep) {
  const index = WIZARD_STAGES.findIndex((stage) =>
    (stage.steps as readonly WizardStep[]).includes(step),
  );
  return { index, stage: WIZARD_STAGES[index] ?? WIZARD_STAGES[0] };
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
