import {
  DEFAULT_EDITORIAL_CONFIG,
  DEFAULT_PRODUCT_PRICING,
  bookFormatPrices,
  defaultCountryConfig,
  marginUsdMinor,
  quote,
  referencePrintCost,
  unitPriceUsdMinor,
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
import { bookPrintCost, perCopy, type PrintEstimate } from './service';

/**
 * Precios claros (DECISIONS 241): para un mismo libro y país, la barra de la muestra (la oferta
 * por extensión), la tarjeta del checkout (`formatPrices`) y el renglón del libro en el resumen
 * (`quote`) dan el mismo número. El margen es fijo: el precio sigue al costo de la imprenta que
 * se va a usar y al de la IA.
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

// Lo que cotiza cada país con su dirección de ejemplo (la imprenta que gana), por ejemplar.
const estimated: Record<'AR' | 'MX', Partial<Record<BookFormat, number>>> = {
  AR: { softcover: 612, hardcover: 1187, booklet: 1004 },
  MX: { softcover: 640, hardcover: 1230, booklet: 1004 },
};
const estimate = (code: 'AR' | 'MX', format: BookFormat): PrintEstimate | null => {
  const production = estimated[code][format];
  return production === undefined
    ? null
    : {
        provider: 'gelato',
        productionUsdMinor: production,
        shippingUsdMinor: 826,
        etaDaysMin: 4,
        etaDaysMax: 8,
      };
};

const cost = (code: 'AR' | 'MX', format: BookFormat, pages: number, routing: PrintRouting | null) =>
  bookPrintCost({
    routing,
    estimate: estimate(code, format),
    matrix: referencePrintCost(matrix[code], format, pages, PRINTERS),
    quantity: 1,
  });

/** El renglón del libro en el resumen, con o sin la cotización de la imprenta para la dirección. */
function summary(
  code: 'AR' | 'MX',
  format: BookFormat,
  pages: number,
  routing: PrintRouting | null,
  professional = false,
  productPricing = pricing,
) {
  const result = quote({
    country: countries[code],
    pricing: productPricing[format],
    fx,
    format,
    pages,
    quantity: 1,
    print: format === 'digital' ? null : cost(code, format, pages, routing),
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

/** Las tarjetas del checkout, con el mismo costo que el resumen. */
const cards = (
  code: 'AR' | 'MX',
  pages: number,
  routing: PrintRouting | null,
  professional = false,
) =>
  bookFormatPrices({
    country: countries[code],
    pricing,
    pages,
    professional,
    productionUsdMinor: (format) => {
      const value = cost(code, format, pages, routing);
      return value ? perCopy(value, 1) : null;
    },
  });

const offerFor = (code: 'AR' | 'MX') =>
  buildOffer({
    code,
    country: countries[code],
    pricing,
    fx,
    products,
    locale: 'es',
    printOptions: matrix[code],
    activePrinters: PRINTERS,
    editorial: DEFAULT_EDITORIAL_CONFIG,
    printCost: (format) => estimated[code][format] ?? null,
  });

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
        const offer = offerFor(code);
        const withoutAddress = cards(code, classic, null, professional);
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
          const card = withoutAddress.find((item) => item.format === format)?.amountMinor;
          const line = summary(code, format, classic, null, professional);
          expect(bar).toBeDefined();
          expect(card).toBe(bar);
          expect(line.components[0]).toMatchObject({ code: 'book', totalMinor: bar });
          if (format === 'digital') continue;
          expect(line.shipping.pending).toBe(true);

          // Con la dirección gana otra imprenta (más cara): tarjeta y resumen suben juntos, con
          // el envío en su renglón.
          const routed = routing(2000, 826);
          const cardWithAddress = cards(code, classic, routed, professional).find(
            (item) => item.format === format,
          )?.amountMinor;
          const lineWithAddress = summary(code, format, classic, routed, professional);
          expect(lineWithAddress.components[0]?.totalMinor).toBe(cardWithAddress);
          expect(cardWithAddress).toBeGreaterThan(bar ?? 0);
          expect(lineWithAddress.shipping).toMatchObject({ minor: 826, pending: false });
        }
      });
    }
  }

  it('si sube el costo de la imprenta o de la IA, sube el precio y el margen queda igual', () => {
    const pages = classic;
    // Margen de cada libro = precio − costo de IA − impresión (antes de redondear a ,99).
    const margin = (production: number, perPage: number) => {
      const product = { ...pricing.hardcover, aiCostPerPageUsdMinor: perPage };
      const ai = perPage * pages;
      return (
        unitPriceUsdMinor(product, production, pages) -
        ai -
        production -
        (marginUsdMinor(product.creationMargin, ai) +
          marginUsdMinor(product.printMargin, production))
      );
    };
    const base = summary('AR', 'hardcover', pages, routing(1187, 826));
    const pricier = summary('AR', 'hardcover', pages, routing(1700, 826));
    expect(pricier.components[0]?.totalMinor).toBeGreaterThan(base.components[0]?.totalMinor ?? 0);
    // El margen sale de la regla del admin, no de lo que quede: con más costo es el mismo.
    expect(margin(1187, 15)).toBe(0);
    expect(margin(1700, 15)).toBe(0);
    expect(marginUsdMinor(pricing.hardcover.printMargin, 1187)).toBe(800);
    expect(marginUsdMinor(pricing.hardcover.printMargin, 1700)).toBe(800);

    const aiPricier = Object.fromEntries(
      Object.entries(pricing).map(([format, item]) => [
        format,
        { ...item, aiCostPerPageUsdMinor: 20 },
      ]),
    ) as Record<BookFormat, ProductPricing>;
    const digital = summary('AR', 'digital', pages, null);
    const digitalPricier = summary('AR', 'digital', pages, null, false, aiPricier);
    // 28 páginas × 5 centavos más de IA: 21,20 → 22,60 (22,99); el margen de creación (USD 17) no cambia.
    expect(digital.components[0]?.totalMinor).toBe(2199);
    expect(digitalPricier.components[0]?.totalMinor).toBe(2299);
    expect(marginUsdMinor(aiPricier.digital.creationMargin, 20 * pages)).toBe(1700);
  });

  it('el «desde» del impreso es el formato más barato en su extensión más corta', () => {
    const offer = offerFor('AR');
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
