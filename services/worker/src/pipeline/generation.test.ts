import { describe, expect, it } from 'vitest';

import { PUBLIC_BRAND_DOMAIN, calmSideOf } from './generation';

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

describe('QR de la contratapa', () => {
  it('apunta siempre al dominio público, también desde staging', () => {
    expect(PUBLIC_BRAND_DOMAIN).toBe('storynido.com');
  });
});
