import { describe, expect, it } from 'vitest';

import { FLOWS, WIZARD_STEPS, reachedIndex } from './steps';

describe('pasos del creador por línea', () => {
  it('lee el paso por nombre', () => {
    expect(reachedIndex(FLOWS.families, { wizardStepKey: 'lesson', wizardStep: 0 })).toBe(
      FLOWS.families.indexOf('lesson'),
    );
  });

  it('migra los borradores viejos desde el índice histórico', () => {
    const legacy = WIZARD_STEPS.indexOf('style');
    expect(reachedIndex(FLOWS.families, { wizardStep: legacy })).toBe(
      FLOWS.families.indexOf('style'),
    );
  });

  it('un paso que la línea no tiene cuenta como el anterior que sí está', () => {
    // Eventos no tiene enseñanza: un borrador viejo parado ahí queda en recuerdos.
    expect(reachedIndex(FLOWS.events, { wizardStep: WIZARD_STEPS.indexOf('lesson') })).toBe(
      FLOWS.events.indexOf('memories'),
    );
  });

  it('un valor desconocido arranca desde el principio', () => {
    expect(reachedIndex(FLOWS.professionals, { wizardStepKey: 'otro', wizardStep: 99 })).toBe(0);
  });

  it('todas las líneas terminan en el resumen', () => {
    for (const flow of Object.values(FLOWS)) expect(flow.at(-1)).toBe('review');
  });
});
