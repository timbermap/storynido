import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PRODUCT_PRICING,
  charmPrice,
  fromUsdMinor,
  marginUsdMinor,
  unitPriceUsdMinor,
  withPaymentFee,
} from './product-pricing';

const fx = { rates: { MXN: 18.5, CLP: 940, EUR: 0.92 }, source: 'test', date: '2026-10-29' };

describe('precio por costo + dos márgenes', () => {
  it('margen fijo (con monto por página), porcentaje o porcentaje con mínimo', () => {
    const base = { fixedUsdMinor: 1500, percent: 40 };
    expect(marginUsdMinor({ ...base, mode: 'fixed' }, 2000)).toBe(1500);
    expect(marginUsdMinor({ ...base, mode: 'fixed', perPageUsdMinor: 35 }, 2000, 26)).toBe(2410);
    expect(marginUsdMinor({ ...base, mode: 'percent' }, 2000)).toBe(800);
    expect(marginUsdMinor({ ...base, mode: 'percent_min' }, 2000)).toBe(1500);
    expect(marginUsdMinor({ ...base, mode: 'percent_min' }, 5000)).toBe(2000);
  });

  it('digital: IA por páginas generadas + margen de creación (base + por página)', () => {
    const digital = DEFAULT_PRODUCT_PRICING.digital;
    // Mini (10 generadas): 1,50 + 8 + 3,50 = 13; clásico (26): 3,90 + 8 + 9,10 = 21. La imprenta no cuenta.
    expect(unitPriceUsdMinor(digital, 0, 10)).toBe(1300);
    expect(unitPriceUsdMinor(digital, 0, 26)).toBe(2100);
    expect(unitPriceUsdMinor(digital, 999, 26)).toBe(2100);
  });

  it('impreso: creación + imprenta + margen de impresión (30 %, mínimo USD 8; tapa dura 10)', () => {
    const softcover = DEFAULT_PRODUCT_PRICING.softcover;
    // Lulu USD 5,83: el 30 % (1,75) no llega al mínimo → 8.
    expect(unitPriceUsdMinor(softcover, 583, 26)).toBe(2100 + 583 + 800);
    // Imprenta USD 40: el 30 % (12) supera el mínimo.
    expect(unitPriceUsdMinor(softcover, 4000, 26)).toBe(2100 + 4000 + 1200);
    expect(unitPriceUsdMinor(DEFAULT_PRODUCT_PRICING.hardcover, 1187, 26)).toBe(2100 + 1187 + 1000);
  });

  it('la comisión de cobro es un costo: el precio se calcula hacia arriba', () => {
    expect(withPaymentFee(2100, 3.5)).toBe(2177);
    expect(withPaymentFee(0, 3.5)).toBe(0);
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
