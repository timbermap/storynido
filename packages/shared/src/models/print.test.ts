import { describe, expect, it } from 'vitest';

import { printAvailability, printCandidates, rankPrintQuotes, type PrintOption } from './print';

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

describe('varias imprentas', () => {
  const options = [
    option({ provider: 'mock' }),
    option({ provider: 'mock', format: 'hardcover', pages: { min: 20, max: 120, multipleOf: 2 } }),
    option({ provider: 'gelato' }),
    option({ provider: 'gelato', format: 'hardcover' }),
    option({ provider: 'lulu', enabled: false }),
  ];

  it('solo las activas que pueden con el pedido entero', () => {
    const soft = [{ format: 'softcover', pages: 16, quantity: 1 }];
    expect(printCandidates(options, soft, ['mock', 'gelato', 'lulu'])).toEqual(['mock', 'gelato']);
    // Gelato no está activa en este ambiente.
    expect(printCandidates(options, soft, ['mock'])).toEqual(['mock']);
    // Tapa dura de 16 páginas: la imprenta simulada pide 20 como mínimo.
    const hard = [{ format: 'hardcover', pages: 16, quantity: 1 }];
    expect(printCandidates(options, hard, ['mock', 'gelato'])).toEqual(['gelato']);
    // Ninguna: solo digital.
    expect(printCandidates(options, soft, ['lulu'])).toEqual([]);
  });

  it('gana la más barata; si empatan, la que llega antes', () => {
    const quote = (provider: string, totalCostUsdMinor: number, etaDaysMax: number) => ({
      provider,
      totalCostUsdMinor,
      etaDaysMin: 3,
      etaDaysMax,
    });
    const ranked = rankPrintQuotes([
      quote('a', 1800, 9),
      quote('b', 1500, 12),
      quote('c', 1500, 8),
    ]);
    expect(ranked.map((item) => item.provider)).toEqual(['c', 'b', 'a']);
  });
});
