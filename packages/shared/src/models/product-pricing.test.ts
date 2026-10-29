import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PRODUCT_PRICING,
  charmPrice,
  fromUsdMinor,
  marginUsdMinor,
  unitPriceUsdMinor,
} from './product-pricing';

const fx = { rates: { MXN: 18.5, CLP: 940, EUR: 0.92 }, source: 'test', date: '2026-10-29' };

describe('precio por costo + margen', () => {
  it('margen fijo, porcentaje o porcentaje con mínimo', () => {
    const base = { marginFixedUsdMinor: 1500, marginPercent: 40 };
    expect(marginUsdMinor({ ...base, marginMode: 'fixed' }, 2000)).toBe(1500);
    expect(marginUsdMinor({ ...base, marginMode: 'percent' }, 2000)).toBe(800);
    expect(marginUsdMinor({ ...base, marginMode: 'percent_min' }, 2000)).toBe(1500);
    expect(marginUsdMinor({ ...base, marginMode: 'percent_min' }, 5000)).toBe(2000);
  });

  it('libro = costo propio + impresión + margen + extensión', () => {
    const softcover = DEFAULT_PRODUCT_PRICING.softcover;
    // USD 1 propio + 5,83 de Lulu + 27 de margen.
    expect(unitPriceUsdMinor(softcover, 583, null)).toBe(100 + 583 + 2700);
    expect(unitPriceUsdMinor(softcover, 583, 'mini')).toBe(100 + 583 + 2700 - 300);
    expect(unitPriceUsdMinor(DEFAULT_PRODUCT_PRICING.digital, 0, 'classic')).toBe(1999);
  });

  it('convierte de dólares a la moneda del comprador', () => {
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
