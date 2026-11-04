import { describe, expect, it } from 'vitest';

import { defaultCountryConfig } from './commerce';
import { DEFAULT_EDITORIAL_CONFIG } from './editorial';
import { buildPriceTable } from './price-table';
import { DEFAULT_PRO_DISCOUNTS } from './pricing';
import type { PrintOption } from './print';
import { DEFAULT_PRODUCT_PRICING, type ProductPricing } from './product-pricing';

const now = new Date('2026-11-03T12:00:00Z');
const pricing = Object.fromEntries(
  Object.entries(DEFAULT_PRODUCT_PRICING).map(([format, value]) => [
    format,
    { ...value, updatedAt: now },
  ]),
) as Record<keyof typeof DEFAULT_PRODUCT_PRICING, ProductPricing>;

const option = (
  provider: string,
  format: PrintOption['format'],
  cost: number,
  pages = { min: 24, max: 200, multipleOf: 2 },
): PrintOption => ({
  country: 'US',
  format,
  provider,
  sku: 'sku',
  enabled: true,
  qaSamplePassed: true,
  pages,
  maxQuantity: 100,
  etaDaysMin: 5,
  etaDaysMax: 10,
  productionCostUsdMinor: cost,
  updatedAt: now,
});

const table = (active: readonly string[]) =>
  buildPriceTable({
    countries: [{ ...defaultCountryConfig('US', now), active: true }],
    pricing,
    editorial: DEFAULT_EDITORIAL_CONFIG,
    printOptions: () => [
      option('lulu', 'softcover', 559),
      option('gelato', 'softcover', 1051),
      option('gelato', 'hardcover', 1373),
      option('gelato', 'booklet', 996, { min: 8, max: 24, multipleOf: 4 }),
    ],
    activePrinters: active,
    proDiscounts: DEFAULT_PRO_DISCOUNTS,
    fx: { rates: {}, source: 'test', date: '2026-11-03' },
    now,
  });

const row = (rows: ReturnType<typeof table>, length: string, format: string) =>
  rows.find((item) => item.length === length && item.format === format);

describe('tabla «Precio final» del admin', () => {
  it('digital por extensión: IA por páginas + margen, redondeado a ,99', () => {
    const rows = table(['lulu', 'gelato']);
    expect(row(rows, 'mini', 'digital')).toMatchObject({
      pages: 12,
      aiCostUsdMinor: 180,
      creationMarginUsdMinor: 1700,
      priceMinor: 1899,
      blocked: null,
    });
    expect(row(rows, 'classic', 'digital')?.priceMinor).toBe(2199);
    // Profesionales: 10 % antes de redondear.
    expect(row(rows, 'mini', 'digital')?.proPriceMinor).toBe(1699);
  });

  it('impreso: la imprenta activa más barata + margen con mínimo de USD 8', () => {
    const rows = table(['lulu', 'gelato']);
    expect(row(rows, 'classic', 'softcover')).toMatchObject({
      provider: 'lulu',
      productionCostUsdMinor: 559,
      printMarginUsdMinor: 800,
      priceMinor: 3499,
    });
    // Sin Lulu activa, gana Gelato.
    expect(row(table(['gelato']), 'classic', 'softcover')).toMatchObject({
      provider: 'gelato',
      priceMinor: 3999,
    });
    // El grapado cuenta las tapas: Mini 12 → 16 páginas de imprenta.
    expect(row(rows, 'mini', 'booklet')).toMatchObject({ printPages: 16, priceMinor: 3699 });
  });

  it('dice por qué una combinación no se vende', () => {
    const rows = table(['lulu', 'gelato']);
    expect(row(rows, 'mini', 'softcover')).toMatchObject({
      blocked: 'not_for_length',
      priceMinor: null,
    });
    expect(row(table([]), 'classic', 'hardcover')).toMatchObject({
      blocked: 'no_printer',
      provider: null,
    });
  });
});
