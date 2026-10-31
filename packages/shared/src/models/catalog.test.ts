import { describe, expect, it } from 'vitest';

import { stageOf, withChildName } from './catalog';

describe('etapas de lectura', () => {
  it('cada historia cae en la etapa que contiene el centro de su rango', () => {
    expect(stageOf({ ageMin: 0, ageMax: 3 })).toBe('babies');
    expect(stageOf({ ageMin: 3, ageMax: 6 })).toBe('little');
    expect(stageOf({ ageMin: 3, ageMax: 7 })).toBe('little');
    expect(stageOf({ ageMin: 5, ageMax: 9 })).toBe('readers');
    expect(stageOf({ ageMin: 6, ageMax: 10 })).toBe('readers');
    expect(stageOf({ ageMin: 9, ageMax: 12 })).toBe('big');
  });
});

describe('nombre en el título', () => {
  it('reemplaza la marca en los tres idiomas', () => {
    expect(withChildName('[Nombre] y el valle de los dinosaurios', 'Tomás')).toBe(
      'Tomás y el valle de los dinosaurios',
    );
    expect(withChildName('[Name] and the Dinosaur Valley', 'Tom')).toBe(
      'Tom and the Dinosaur Valley',
    );
    expect(withChildName('[Nome] e o vale dos dinossauros', 'Téo')).toBe(
      'Téo e o vale dos dinossauros',
    );
  });

  it('un título sin marca queda igual', () => {
    expect(withChildName('Mi visita al dentista', 'Tomás')).toBe('Mi visita al dentista');
  });
});
