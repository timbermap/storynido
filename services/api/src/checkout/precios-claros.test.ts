import {
  DEFAULT_EDITORIAL_CONFIG,
  DEFAULT_PRODUCT_PRICING,
  bookFormatPrices,
  defaultCountryConfig,
  quote,
  type BookFormat,
  type CountryCode,
  type CountryConfig,
  type PrintOption,
  type PrintRouting,
  type Product,
  type ProductPricing,
} from '@storynido/shared';
import { describe, expect, it } from 'vitest';

import { buildOffer } from '../routes/catalog';
import { bookPrintCost } from './service';

/**
 * Precios claros (DECISIONS 236): para un mismo libro y país, la barra de la muestra (la oferta
 * por extensión), la tarjeta del checkout (`formatPrices`) y el renglón del libro en el resumen
 * (`quote`) dan el mismo número, y la dirección solo agrega el envío.
 */
const now = new Date('2026-11-07T00:00:00Z');
const fx = { rates: { USD: 1, ARS: 1545, MXN: 18.7 }, source: 'test', date: '2026-11-07' };
const PRINTERS = ['gelato', 'cloudprinter'];

const pricing = Object.fromEntries(
  (['digital', 'softcover', 'hardcover', 'booklet'] as const).map((format) => [
    format,
    { ...DEFAULT_PRODUCT_PRICING[format], updatedAt: now },
  ]),
) as Record<BookFormat, ProductPricing>;

const products: Product[] = (['digital', 'softcover', 'hardcover', 'booklet'] as const).map(
  (format) => ({
    format,
    pageCount: format === 'booklet' ? 12 : 28,
    active: true,
    name: { es: format, en: format, pt: format },
    createdAt: now,
    updatedAt: now,
  }),
);

const option = (
  country: CountryCode,
  format: PrintOption['format'],
  provider: string,
  cost: number,
): PrintOption => ({
  country,
  format,
  provider,
  sku: `${provider}-${format}`,
  enabled: true,
  qaSamplePassed: true,
  pages:
    format === 'booklet'
      ? { min: 8, max: 24, multipleOf: 4 }
      : { min: provider === 'gelato' ? 28 : 24, max: 200, multipleOf: 2 },
  maxQuantity: 100,
  etaDaysMin: 4,
  etaDaysMax: 8,
  productionCostUsdMinor: cost,
  updatedAt: now,
});

// Matriz de cada país: dos imprentas por fotolibro (gana la más barata como referencia).
const matrix: Record<'AR' | 'MX', PrintOption[]> = {
  AR: [
    option('AR', 'softcover', 'gelato', 550),
    option('AR', 'softcover', 'cloudprinter', 780),
    option('AR', 'hardcover', 'gelato', 1150),
    option('AR', 'hardcover', 'cloudprinter', 1320),
    option('AR', 'booklet', 'gelato', 996),
  ],
  MX: [
    option('MX', 'softcover', 'gelato', 610),
    option('MX', 'hardcover', 'gelato', 1240),
    option('MX', 'hardcover', 'cloudprinter', 1190),
    option('MX', 'booklet', 'gelato', 996),
  ],
};

const countries: Record<'AR' | 'MX', CountryConfig> = {
  AR: { ...defaultCountryConfig('AR'), updatedAt: now },
  MX: {
    ...defaultCountryConfig('MX'),
    formats: { digital: true, softcover: true, hardcover: true, booklet: true },
    taxBasisPoints: 1600,
    taxIncludedInPrice: true,
    updatedAt: now,
  },
};

/** El renglón del libro en el resumen, con o sin la cotización de la imprenta para la dirección. */
function summaryBookLine(
  code: 'AR' | 'MX',
  format: BookFormat,
  pages: number,
  routing: PrintRouting | null,
  professional = false,
) {
  const print =
    format === 'digital'
      ? null
      : bookPrintCost({
          options: matrix[code],
          activePrinters: PRINTERS,
          format,
          pages,
          quantity: 1,
          routing,
        });
  const result = quote({
    country: countries[code],
    pricing: pricing[format],
    fx,
    format,
    pages,
    quantity: 1,
    print,
    coupon: null,
    couponCode: null,
    promotions: [],
    now,
    pro: {
      purchases: 0,
      config: { windowDays: 90, tiers: [], physicalMaxPercent: 15 },
      professional,
    },
  });
  if (!result.ok) throw new Error(result.error);
  return result.snapshot;
}

const routing = (production: number, shipping: number): PrintRouting => ({
  provider: 'cloudprinter',
  totalCostUsdMinor: production + shipping,
  productionCostUsdMinor: production,
  shippingCostUsdMinor: shipping,
  etaDaysMin: 5,
  etaDaysMax: 9,
  quotes: [],
  quotedAt: now,
});

describe('precios claros: muestra = tarjeta = resumen', () => {
  const classic = DEFAULT_EDITORIAL_CONFIG.lengths.classic.interiorPages;

  for (const code of ['AR', 'MX'] as const) {
    for (const professional of [false, true]) {
      it(`${code}${professional ? ' (cuenta profesional)' : ''}: ebook, tapa blanda y tapa dura de ${String(classic)} páginas`, () => {
        const offer = buildOffer({
          code,
          country: countries[code],
          pricing,
          fx,
          products,
          locale: 'es',
          printOptions: matrix[code],
          activePrinters: PRINTERS,
          editorial: DEFAULT_EDITORIAL_CONFIG,
        });
        const cards = bookFormatPrices({
          country: countries[code],
          pricing,
          options: matrix[code],
          activeProviders: PRINTERS,
          pages: classic,
          professional,
        });
        for (const format of ['digital', 'softcover', 'hardcover'] as const) {
          // Barra de la muestra: lo que la oferta da para la extensión del libro.
          const bar =
            format === 'digital'
              ? (professional ? offer.proLengthPrices : offer.lengthPrices).find(
                  (item) => item.length === 'classic',
                )?.amountMinor
              : offer.printLengthPrices
                  .filter((item) => item.length === 'classic' && item.format === format)
                  .map((item) => (professional ? item.proAmountMinor : item.amountMinor))[0];
          const card = cards.find((item) => item.format === format)?.amountMinor;
          const summary = summaryBookLine(code, format, classic, null, professional);
          expect(bar).toBeDefined();
          expect(card).toBe(bar);
          expect(summary.components[0]).toMatchObject({ code: 'book', totalMinor: bar });

          if (format !== 'digital') {
            // Con la dirección: la imprenta elegida cuesta otra cosa, pero el libro vale lo mismo
            // y el envío va en su propio renglón.
            const withAddress = summaryBookLine(
              code,
              format,
              classic,
              routing(2000, 826),
              professional,
            );
            expect(withAddress.components[0]?.totalMinor).toBe(bar);
            expect(withAddress.shipping).toMatchObject({ minor: 826, pending: false });
            expect(summary.shipping.pending).toBe(true);
          }
        }
      });
    }
  }

  it('el «desde» del impreso es el formato más barato en su extensión más corta', () => {
    const offer = buildOffer({
      code: 'AR',
      country: countries.AR,
      pricing,
      fx,
      products,
      locale: 'es',
      printOptions: matrix.AR,
      activePrinters: PRINTERS,
    });
    const printed = offer.formats.filter((item) => item.format !== 'digital');
    const lowest = Math.min(...offer.printLengthPrices.map((item) => item.amountMinor));
    expect(Math.min(...printed.map((item) => item.amountMinor))).toBe(lowest);
    // Digital: la extensión más corta (mini, 12 páginas): 0,15 × 12 + 17 = 18,80 → 18,99.
    expect(offer.formats.find((item) => item.format === 'digital')?.amountMinor).toBe(1899);
  });

  it('la moneda de referencia es la del país del pedido', () => {
    for (const [code, currency] of [
      ['AR', 'ARS'],
      ['MX', 'MXN'],
    ] as const) {
      const offer = buildOffer({
        code,
        country: countries[code],
        pricing,
        fx,
        products,
        locale: 'es',
        printOptions: matrix[code],
        activePrinters: PRINTERS,
      });
      expect(offer.local?.currency).toBe(currency);
    }
  });
});
