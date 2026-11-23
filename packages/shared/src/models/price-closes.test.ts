import { describe, expect, it } from 'vitest';

import { bookPriceMinor } from './book-price';
import {
  DEFAULT_EDITORIAL_CONFIG,
  editorialPlan,
  miniPricedPages,
  pricedPages,
  type BookLength,
  type ContentType,
} from './editorial';
import {
  DEFAULT_PRODUCT_PRICING,
  aiCostUsdMinor,
  minNetMarginUsdMinor,
  unitPriceUsdMinor,
} from './product-pricing';

// Staging (20 nov 2026): PayPal 5,4 % + USD 0,30 en el producto digital.
const digital = {
  ...DEFAULT_PRODUCT_PRICING.digital,
  paymentFeePercent: 5.4,
  paymentFeeFixedUsdMinor: 30,
};
const config = DEFAULT_EDITORIAL_CONFIG;
const lengths: BookLength[] = ['mini', 'short', 'classic', 'epic'];
const types: ContentType[] = ['story', 'coloring', 'activities', 'story_activities'];

describe('los precios de los ebooks cierran con la comisión de cobro', () => {
  for (const length of lengths) {
    for (const contentType of types) {
      it(`${length} · ${contentType}`, () => {
        const plan = editorialPlan(
          { length, contentType, textDensity: 'balanced', readingLevel: 'developing' },
          config,
          config.lengths[length].interiorPages,
        );
        const pages = pricedPages(plan.narrativePages + plan.activityPages, config);
        const aiPages = pricedPages(plan.narrativePages, config);
        const ai = aiCostUsdMinor(digital, aiPages);
        const margin = unitPriceUsdMinor(digital, 0, pages, aiPages) - ai;
        const net = (price: number) => price - Math.round(price * 0.054 + 30) - ai;
        const price = bookPriceMinor(digital, 0, pages, false, miniPricedPages(config), aiPages);
        const pro = bookPriceMinor(digital, 0, pages, true, miniPricedPages(config), aiPages);
        // Precio de lista: queda el margen objetivo entero (el redondeo a ,99 solo suma).
        expect(net(price)).toBeGreaterThanOrEqual(margin);
        // Con el descuento profesional, nunca debajo del margen neto mínimo ni de US$ 13,99.
        expect(net(pro)).toBeGreaterThanOrEqual(minNetMarginUsdMinor(digital));
        expect(pro).toBeGreaterThanOrEqual(1399);
        expect(pro).toBeLessThanOrEqual(price);
      });
    }
  }

  it('los precios de lista de cuento son los de la tabla', () => {
    const price = (length: BookLength) => {
      const plan = editorialPlan(
        { length, contentType: 'story', textDensity: 'balanced', readingLevel: 'developing' },
        config,
        config.lengths[length].interiorPages,
      );
      const pages = pricedPages(plan.narrativePages, config);
      return bookPriceMinor(digital, 0, pages, false, miniPricedPages(config), pages);
    };
    expect(lengths.map(price)).toEqual([1499, 1699, 2299, 2499]);
  });

  it('el precio profesional del cuento sube con cada extensión (Corto no iguala a Mini)', () => {
    const pro = (length: BookLength) => {
      const plan = editorialPlan(
        { length, contentType: 'story', textDensity: 'balanced', readingLevel: 'developing' },
        config,
        config.lengths[length].interiorPages,
      );
      const pages = pricedPages(plan.narrativePages, config);
      return bookPriceMinor(digital, 0, pages, true, miniPricedPages(config), pages);
    };
    const prices = lengths.map(pro);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(new Set(prices).size).toBe(prices.length);
  });
});
