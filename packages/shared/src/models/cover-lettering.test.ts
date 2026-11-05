import { describe, expect, it } from 'vitest';

import { LETTER_JITTER, letterJitter, splitCoverTitle } from './cover-lettering';

describe('letra a mano de las portadas', () => {
  it('el mismo nombre da siempre el mismo giro (muestra y libro iguales), sin importar mayúsculas', () => {
    expect(letterJitter('Sebas')).toEqual(letterJitter('Sebas'));
    expect(letterJitter('SEBAS').map((l) => l.rotate)).toEqual(
      letterJitter('sebas').map((l) => l.rotate),
    );
    expect(letterJitter('Sebas')).not.toEqual(letterJitter('Lucía'));
  });

  it('giros de ±5° y desplazamientos de ±4 %, y los espacios derechos', () => {
    for (const letter of letterJitter('María José Ñandú')) {
      expect(Math.abs(letter.rotate)).toBeLessThanOrEqual(LETTER_JITTER.maxRotateDeg);
      expect(Math.abs(letter.shift)).toBeLessThanOrEqual(LETTER_JITTER.maxShift);
      if (letter.char === ' ') expect(letter).toEqual({ char: ' ', rotate: 0, shift: 0 });
    }
  });

  it('parte el título alrededor del nombre, con tildes y sin importar mayúsculas', () => {
    expect(splitCoverTitle('La gran aventura espacial de Tomás', 'tomás')).toEqual({
      before: 'La gran aventura espacial de',
      name: 'Tomás',
      after: '',
    });
    expect(splitCoverTitle('Sebas y el misterio del faro', 'Sebas')).toEqual({
      before: '',
      name: 'Sebas',
      after: 'y el misterio del faro',
    });
    expect(splitCoverTitle('Un cuento sin nombre', 'Lu')).toEqual({
      before: 'Un cuento sin nombre',
      name: '',
      after: '',
    });
  });
});
