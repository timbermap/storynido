import { describe, expect, it } from 'vitest';

import { printAvailability, type PrintOption } from './print';

const option = (overrides: Partial<PrintOption> = {}): PrintOption => ({
  country: 'MX',
  format: 'softcover',
  provider: 'mock',
  sku: 'photobook-softcover-210x280',
  enabled: true,
  qaSamplePassed: true,
  pages: { min: 12, max: 120, multipleOf: 2 },
  maxQuantity: 100,
  etaDaysMin: 6,
  etaDaysMax: 10,
  productionCostUsdMinor: 900,
  updatedAt: new Date(),
  ...overrides,
});

describe('matriz de impresión', () => {
  it('se imprime solo habilitado, con la muestra física aprobada y dentro de las reglas', () => {
    expect(printAvailability(option(), 16, 1)).toEqual({ ok: true });
    expect(printAvailability(null, 16, 1)).toEqual({ ok: false, reason: 'not_offered' });
    expect(printAvailability(option({ enabled: false }), 16, 1)).toEqual({
      ok: false,
      reason: 'not_offered',
    });
    expect(printAvailability(option({ qaSamplePassed: false }), 16, 1)).toEqual({
      ok: false,
      reason: 'sample_pending',
    });
    expect(printAvailability(option(), 13, 1)).toEqual({ ok: false, reason: 'pages' });
    expect(printAvailability(option(), 10, 1)).toEqual({ ok: false, reason: 'pages' });
    expect(printAvailability(option(), 16, 101)).toEqual({ ok: false, reason: 'quantity' });
  });
});
