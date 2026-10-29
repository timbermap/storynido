import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PRODUCT_PRICING,
  charmPrice,
  fromUsdMinor,
  marginUsdMinor,
  unitPriceUsdMinor,
} from './product-pricing';

const fx = { rates: { MXN: 18.5, CLP: 940, EUR: 0.92 }, source: 'test', date: '2026-10-29' };

describe('precio por costo + dos márgenes', () => {
  it('margen fijo, porcentaje o porcentaje con mínimo', () => {
    const base = { fixedUsdMinor: 1500, percent: 40 };
    expect(marginUsdMinor({ ...base, mode: 'fixed' }, 2000)).toBe(1500);
    expect(marginUsdMinor({ ...base, mode: 'percent' }, 2000)).toBe(800);
    expect(marginUsdMinor({ ...base, mode: 'percent_min' }, 2000)).toBe(1500);
    expect(marginUsdMinor({ ...base, mode: 'percent_min' }, 5000)).toBe(2000);
  });

  it('digital: IA por páginas + margen de creación (el libro largo cuesta más solo)', () => {
    const digital = DEFAULT_PRODUCT_PRICING.digital;
    // USD 0,15 × 12 + 17 = 18,80; × 28 = 4,20 + 17 = 21,20. La imprenta no cuenta.
    expect(unitPriceUsdMinor(digital, 0, 12)).toBe(1880);
    expect(unitPriceUsdMinor(digital, 0, 28)).toBe(2120);
    expect(unitPriceUsdMinor(digital, 999, 28)).toBe(2120);
  });

  it('impreso: creación + imprenta + margen de impresión (30 %, mínimo USD 8)', () => {
    const softcover = DEFAULT_PRODUCT_PRICING.softcover;
    // Lulu USD 5,83: el 30 % (1,75) no llega al mínimo → 8.
    expect(unitPriceUsdMinor(softcover, 583, 28)).toBe(2120 + 583 + 800);
    // Imprenta USD 40: el 30 % (12) supera el mínimo.
    expect(unitPriceUsdMinor(softcover, 4000, 28)).toBe(2120 + 4000 + 1200);
  });

  it('convierte de dólares a otra moneda (referencia)', () => {
    expect(fromUsdMinor(1999, 'USD', fx)).toBe(1999);
    expect(fromUsdMinor(1999, 'MXN', fx)).toBe(36982);
    expect(fromUsdMinor(1999, 'CLP', fx)).toBe(18791);
    expect(fromUsdMinor(1999, 'BRL', fx)).toBeNull();
  });

  it('precio lindo: siempre hacia arriba', () => {
    expect(charmPrice(36982, 'MXN')).toBe(36999);
    expect(charmPrice(36900, 'MXN')).toBe(36999);
    expect(charmPrice(36999, 'MXN')).toBe(36999);
    expect(charmPrice(18791, 'CLP')).toBe(18900);
    expect(charmPrice(18900, 'CLP')).toBe(18900);
    expect(charmPrice(0, 'USD')).toBe(0);
  });
});
