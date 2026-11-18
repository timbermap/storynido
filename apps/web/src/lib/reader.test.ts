import { describe, expect, it } from 'vitest';

import { fitPageHeight, readerSpreads, spreadIndexOf, wantsSpread } from './reader';

describe('readerSpreads', () => {
  it('de a una página', () => {
    expect(readerSpreads(3, false)).toEqual([[1], [2], [3]]);
  });

  it('a doble página: la portada sola y después de a dos', () => {
    expect(readerSpreads(6, true)).toEqual([[1], [2, 3], [4, 5], [6]]);
    expect(readerSpreads(5, true)).toEqual([[1], [2, 3], [4, 5]]);
  });

  it('un libro muy corto o vacío', () => {
    expect(readerSpreads(2, true)).toEqual([[1], [2]]);
    expect(readerSpreads(0, true)).toEqual([]);
  });
});

describe('spreadIndexOf', () => {
  it('mantiene el lugar al cambiar de modo', () => {
    const spreads = readerSpreads(8, true);
    expect(spreadIndexOf(spreads, 1)).toBe(0);
    expect(spreadIndexOf(spreads, 5)).toBe(2);
    expect(spreadIndexOf(spreads, 99)).toBe(0);
  });
});

describe('wantsSpread', () => {
  it('doble página en una compu con páginas cuadradas', () => {
    expect(wantsSpread({ width: 1280, height: 640 }, 1)).toBe(true);
  });

  it('una sola en el celular, aunque esté acostado si es angosto', () => {
    expect(wantsSpread({ width: 390, height: 700 }, 1)).toBe(false);
    expect(wantsSpread({ width: 680, height: 320 }, 1)).toBe(false);
  });

  it('una sola si las dos quedarían muy chicas', () => {
    expect(wantsSpread({ width: 900, height: 800 }, 1)).toBe(false);
  });
});

describe('fitPageHeight', () => {
  it('entra en el alto o en el ancho, lo que limite', () => {
    expect(fitPageHeight({ width: 1000, height: 600 }, 1, 2)).toBe(500);
    expect(fitPageHeight({ width: 1000, height: 400 }, 1, 2)).toBe(400);
    expect(fitPageHeight({ width: 390, height: 700 }, 0.75, 1)).toBe(520);
  });
});
