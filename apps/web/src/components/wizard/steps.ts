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

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
