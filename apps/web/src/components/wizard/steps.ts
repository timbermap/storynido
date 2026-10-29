import type { Channel } from '@storynido/shared';

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
 * Las 4 etapas que ve el cliente (AUDITORIA-PRODUCTO §2): agrupan los pasos sin cambiar su orden,
 * así los borradores guardados siguen en el mismo lugar. Recuerdos y enseñanza son opcionales
 * dentro de "La aventura".
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

/**
 * Pasos que no se muestran según la línea comercial. El índice guardado (wizardStep) es
 * siempre el de la lista completa, así los borradores no se rompen si esto cambia.
 */
export function hiddenSteps(channel: Channel): readonly WizardStep[] {
  // Eventos: un cuento de cumpleaños para todos los invitados, sin enseñanza particular.
  return channel === 'events' ? ['lesson'] : [];
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
