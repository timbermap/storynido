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
    // Celebraciones ya no tiene enseñanza ni estilo: un borrador parado ahí sigue en la fiesta.
    expect(reachedIndex(FLOWS.events, { wizardStep: WIZARD_STEPS.indexOf('lesson') })).toBe(
      FLOWS.events.indexOf('party'),
    );
    for (const wizardStepKey of ['story', 'memories', 'style']) {
      expect(reachedIndex(FLOWS.events, { wizardStepKey, wizardStep: 0 })).toBe(
        FLOWS.events.indexOf('party'),
      );
    }
    // Con solo el protagonista hecho, se retoma en el personaje (fotos), el segundo paso.
    expect(reachedIndex(FLOWS.families, { wizardStep: WIZARD_STEPS.indexOf('photos') })).toBe(
      FLOWS.families.indexOf('photos'),
    );
  });

  it('los pasos nuevos no mueven el índice histórico de los borradores viejos', () => {
    expect(WIZARD_STEPS.slice(0, 7)).toEqual([
      'child',
      'photos',
      'story',
      'memories',
      'lesson',
      'style',
      'review',
    ]);
    expect(reachedIndex(FLOWS.events, { wizardStepKey: 'kit', wizardStep: 0 })).toBe(
      FLOWS.events.indexOf('kit'),
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
  it('las tres líneas arrancan por el personaje', async () => {
    const { stagesFor } = await import('./steps');
    for (const flow of Object.values(FLOWS)) {
      expect(flow.slice(0, 2)).toEqual(['child', 'photos']);
      expect(stagesFor(flow).map((stage) => stage.key)).toEqual([
        'character',
        'adventure',
        'settings',
        'preview',
      ]);
    }
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
