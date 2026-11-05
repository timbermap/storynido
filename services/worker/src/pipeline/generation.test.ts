import { describe, expect, it } from 'vitest';

import { calmSideOf } from './generation';

const scene = (pageIndex: number) => ({
  pageIndex,
  sceneGoal: '',
  emotionalBeat: '',
  mustBeVisible: [],
  notVisible: [],
  continuityFacts: [],
  wordBudget: 40,
  personalDetail: null,
});

describe('lado calmo para el texto', () => {
  it('es el mismo que pide el prompt: arriba en impares, abajo en pares', () => {
    expect(calmSideOf(scene(1))).toBe('top');
    expect(calmSideOf(scene(2))).toBe('bottom');
    expect(calmSideOf(null)).toBeNull();
  });
});
