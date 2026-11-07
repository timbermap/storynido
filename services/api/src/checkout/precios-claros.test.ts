import {
  DEFAULT_EDITORIAL_CONFIG,
  DEFAULT_PRODUCT_PRICING,
  bookFormatPrices,
  defaultCountryConfig,
  marginUsdMinor,
  quote,
  referencePrintCost,
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

/** Páginas con ilustración generada de un cuento (las 2 fijas no cuentan). */
const generated = (interior: number) => interior - 2;

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
    pages: generated(pages),
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
    pages: generated(pages),
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
                  (item) => item.length === 'classic' && item.contentType === 'story',
                )?.amountMinor
              : offer.printLengthPrices
                  .filter(
                    (item) =>
                      item.length === 'classic' &&
                      item.contentType === 'story' &&
                      item.format === format,
                  )
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
          // Envío al costo más su parte de la comisión: 8,26 ÷ 0,965 → 8,56.
          expect(lineWithAddress.shipping).toMatchObject({ minor: 856, pending: false });
        }
      });
    }
  }

  it('si sube el costo de la imprenta o de la IA, sube el precio y el margen neto queda igual', () => {
    const fee = 0.035;
    const pages = generated(classic);
    // Margen neto = lo cobrado − comisión − IA − impresión. La regla del admin: creación 8 + 0,35
    // por página generada; impresión 30 % con mínimo de 10 en tapa dura.
    const net = (price: number, ai: number, production: number) =>
      price * (1 - fee) - ai - production;
    const rule = (ai: number, production: number, product = pricing.hardcover) =>
      marginUsdMinor(product.creationMargin, ai, pages) +
      (product.product === 'digital' ? 0 : marginUsdMinor(product.printMargin, production));

    for (const production of [1187, 1700]) {
      const line = summary('AR', 'hardcover', classic, routing(production, 826));
      const price = line.components[0]?.totalMinor ?? 0;
      const ai = 15 * pages;
      // El margen neto es el de la regla (solo el redondeo a ,99 suma centavos).
      expect(net(price, ai, production) - rule(ai, production)).toBeGreaterThanOrEqual(0);
      expect(net(price, ai, production) - rule(ai, production)).toBeLessThan(100);
      expect(rule(ai, production)).toBe(800 + 35 * 26 + 1000);
    }
    expect(
      summary('AR', 'hardcover', classic, routing(1700, 826)).components[0]?.totalMinor,
    ).toBeGreaterThan(
      summary('AR', 'hardcover', classic, routing(1187, 826)).components[0]?.totalMinor ?? 0,
    );

    const aiPricier = Object.fromEntries(
      Object.entries(pricing).map(([format, item]) => [
        format,
        { ...item, aiCostPerPageUsdMinor: 20 },
      ]),
    ) as Record<BookFormat, ProductPricing>;
    const digital = summary('AR', 'digital', classic, null);
    const digitalPricier = summary('AR', 'digital', classic, null, false, aiPricier);
    // 26 páginas × 5 centavos más de IA: (3,90 + 17,10) ÷ 0,965 = 21,76 → 21,99 pasa a
    // (5,20 + 17,10) ÷ 0,965 = 23,11 → 23,99. El margen de creación (17,10) no cambia.
    expect(digital.components[0]?.totalMinor).toBe(2199);
    expect(digitalPricier.components[0]?.totalMinor).toBe(2399);
    expect(rule(20 * pages, 0, aiPricier.digital)).toBe(rule(15 * pages, 0, pricing.digital));
  });

  it('ebook por extensión: 13,99 / 15,99 / 21,99 / 23,99', () => {
    const offer = offerFor('AR');
    const story = (length: string) =>
      offer.lengthPrices.find((item) => item.length === length && item.contentType === 'story')
        ?.amountMinor;
    expect(['mini', 'short', 'classic', 'epic'].map(story)).toEqual([1399, 1599, 2199, 2399]);
  });

  it('el «desde» del impreso es el formato más barato en su extensión más corta', () => {
    const offer = offerFor('AR');
    const printed = offer.formats.filter((item) => item.format !== 'digital');
    const lowest = Math.min(
      ...offer.printLengthPrices
        .filter((item) => item.contentType === 'story')
        .map((item) => item.amountMinor),
    );
    expect(Math.min(...printed.map((item) => item.amountMinor))).toBe(lowest);
    // Digital: el cuento más corto (mini, 10 páginas generadas): (1,50 + 11,50) ÷ 0,965 → 13,99.
    expect(offer.formats.find((item) => item.format === 'digital')?.amountMinor).toBe(1399);
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
