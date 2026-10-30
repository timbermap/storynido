import { describe, expect, it } from 'vitest';

import { FLOWS, WIZARD_STEPS, reachedIndex } from './steps';

describe('pasos del creador por línea', () => {
  it('lee el paso por nombre', () => {
    expect(reachedIndex(FLOWS.families, { wizardStepKey: 'lesson', wizardStep: 0 })).toBe(
      FLOWS.families.indexOf('lesson'),
    );
  });

  it('migra los borradores viejos desde el índice histórico', () => {
    // Con todo hecho hasta el estilo, en cualquier orden nuevo se retoma en el estilo.
    const legacy = WIZARD_STEPS.indexOf('style');
    expect(reachedIndex(FLOWS.families, { wizardStep: legacy })).toBe(
      FLOWS.families.indexOf('style'),
    );
  });

  it('un borrador viejo retoma en el primer paso del flujo nuevo que le falta', () => {
    // Eventos no tiene enseñanza: parado ahí, ya completó protagonista, fotos, aventura y
    // recuerdos; sigue en el estilo.
    expect(reachedIndex(FLOWS.events, { wizardStep: WIZARD_STEPS.indexOf('lesson') })).toBe(
      FLOWS.events.indexOf('style'),
    );
    // Familia ahora arranca por la aventura: con solo el protagonista hecho, vuelve a la historia.
    expect(reachedIndex(FLOWS.families, { wizardStep: WIZARD_STEPS.indexOf('photos') })).toBe(
      FLOWS.families.indexOf('story'),
    );
  });

  it('un valor desconocido arranca desde el principio', () => {
    expect(reachedIndex(FLOWS.professionals, { wizardStepKey: 'otro', wizardStep: 99 })).toBe(0);
  });

  it('todas las líneas terminan en el resumen', () => {
    for (const flow of Object.values(FLOWS)) expect(flow.at(-1)).toBe('review');
  });
});

describe('etapas por línea', () => {
  it('Familia arranca por la aventura y Celebraciones por el protagonista', async () => {
    const { stagesFor } = await import('./steps');
    expect(stagesFor(FLOWS.families).map((stage) => stage.key)).toEqual([
      'adventure',
      'child',
      'character',
      'preview',
    ]);
    expect(stagesFor(FLOWS.events).map((stage) => stage.key)).toEqual([
      'child',
      'adventure',
      'character',
      'preview',
    ]);
  });

  it('cada flujo recorre sus etapas sin saltar de una a otra y volver', async () => {
    const { stageOf } = await import('./steps');
    for (const flow of Object.values(FLOWS)) {
      const keys = flow.map((step) => stageOf(step).stage.key);
      const changes = keys.filter((key, index) => index === 0 || key !== keys[index - 1]);
      expect(new Set(changes).size).toBe(changes.length);
    }
  });
});
