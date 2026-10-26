import { describe, expect, it } from 'vitest';

import { formatMoney, fromMinorUnits, moneySchema, toMinorUnits } from './currency';

describe('currency', () => {
  it('convierte a unidades mínimas respetando los decimales de cada moneda', () => {
    expect(toMinorUnits(19.99, 'USD')).toBe(1999);
    expect(toMinorUnits(15990, 'CLP')).toBe(15990);
    expect(fromMinorUnits(1999, 'MXN')).toBe(19.99);
  });

  it('formatea según el locale', () => {
    expect(formatMoney({ amountMinor: 1999, currency: 'USD' }, 'en-US')).toBe('$19.99');
    expect(formatMoney({ amountMinor: 15990, currency: 'CLP' }, 'es-CL')).toMatch(/15\.990/);
  });

  it('rechaza montos no enteros o negativos', () => {
    expect(moneySchema.safeParse({ amountMinor: 10.5, currency: 'USD' }).success).toBe(false);
    expect(moneySchema.safeParse({ amountMinor: -1, currency: 'USD' }).success).toBe(false);
    expect(moneySchema.safeParse({ amountMinor: 100, currency: 'ARS' }).success).toBe(false);
  });
});
