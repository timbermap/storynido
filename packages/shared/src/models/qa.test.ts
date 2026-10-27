import { describe, expect, it } from 'vitest';

import { describeTraits, traitsKey, type CharacterTraits } from './character';
import { nameIssues } from './qa';

describe('nombre exacto', () => {
  it('acepta el nombre tal cual, con tildes', () => {
    expect(nameIssues(['Mía miró el cielo.', 'Y Mía sonrió.'], ['Mía'])).toEqual([]);
  });

  it('detecta el nombre sin tilde (caso "Mía" del informe)', () => {
    expect(nameIssues(['Mía corrió.', 'Mia saltó.'], ['Mía'])).toEqual([
      { name: 'Mía', problem: 'misspelled', found: 'Mia' },
    ]);
  });

  it('detecta un nombre que falta y una letra cambiada', () => {
    expect(nameIssues(['Lucía juega.'], ['Martina'])).toEqual([
      { name: 'Martina', problem: 'missing' },
    ]);
    expect(nameIssues(['Martina juega.', 'Martona ríe.'], ['Martina'])).toEqual([
      { name: 'Martina', problem: 'misspelled', found: 'Martona' },
    ]);
  });

  it('no confunde otro personaje con un nombre parecido ("Martín" no es "Martina")', () => {
    expect(nameIssues(['Martina y su amigo Martín.'], ['Martina'])).toEqual([]);
  });

  it('verifica también el apodo', () => {
    expect(nameIssues(['Martina juega.'], ['Martina', 'Tini'])).toEqual([
      { name: 'Tini', problem: 'missing' },
    ]);
  });
});

describe('rasgos confirmados', () => {
  const traits: CharacterTraits = {
    skinTone: 'brown',
    hairColor: 'dark-brown',
    hairLength: 'medium',
    hairType: 'curly',
    eyeColor: 'brown',
    glasses: true,
    distinctive: 'freckles on the nose',
  };

  it('destaca los rasgos que no pueden cambiar', () => {
    const text = describeTraits(traits, ['glasses', 'hair']);
    expect(text).toContain('MUST KEEP IDENTICAL in every illustration');
    expect(text).toContain('wears round glasses');
    expect(text).toContain('shoulder-length, curly, dark brown hair');
  });

  it('la clave cambia si cambia un rasgo o lo que se fija', () => {
    expect(traitsKey(traits, ['glasses'])).not.toBe(traitsKey(traits, []));
    expect(traitsKey(traits, ['glasses'])).not.toBe(
      traitsKey({ ...traits, glasses: false }, ['glasses']),
    );
  });
});
