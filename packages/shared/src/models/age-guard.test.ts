import { describe, expect, it } from 'vitest';

import { ageMismatch, apparentAgeYears } from './character';

describe('edad aparente de la foto', () => {
  it('lee las formas habituales de la ficha', () => {
    expect(apparentAgeYears('about 6 years old')).toBe(6);
    expect(apparentAgeYears('child, 5-7 years old')).toBe(6);
    expect(apparentAgeYears('adult in their 30s')).toBe(35);
    expect(apparentAgeYears('adult man')).toBe(35);
    expect(apparentAgeYears('teenager')).toBe(15);
    expect(apparentAgeYears('toddler')).toBe(2);
    expect(apparentAgeYears('about 18 months old')).toBe(1.5);
    expect(apparentAgeYears('unclear')).toBeNull();
  });

  it('avisa cuando la foto es de un adulto y el cuento dice que cumple 12', () => {
    expect(ageMismatch('adult, around 35 years old', 12)).toBe(true);
    expect(ageMismatch('about 11 years old', 12)).toBe(false);
    expect(ageMismatch('about 4 years old', 13)).toBe(true);
    expect(ageMismatch('elderly woman', 80)).toBe(false);
    expect(ageMismatch('unclear', 6)).toBe(false);
  });
});
