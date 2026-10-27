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
 * Pasos que no se muestran según la línea comercial. El índice guardado (wizardStep) es
 * siempre el de la lista completa, así los borradores no se rompen si esto cambia.
 */
export function hiddenSteps(channel: Channel): readonly WizardStep[] {
  // Eventos: un cuento de cumpleaños para todos los invitados, sin enseñanza particular.
  return channel === 'events' ? ['lesson'] : [];
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
