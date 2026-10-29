import { z } from 'zod';

import { CURRENCY_MINOR_UNITS, type Currency } from '../currency';
import { bookFormatSchema, type BookFormat } from './common';
import type { FxRates } from './metrics';

/**
 * Precio por costo + dos márgenes (DECISIONS 096 y 098), todo en dólares:
 * - creación: el costo de IA (costo por página × páginas del libro) + margen de creación;
 * - impresión (solo impresos): lo que cobra la imprenta para esa dirección + margen de impresión.
 * El envío se cobra al costo. Cada margen se define como monto fijo, porcentaje del costo o
 * porcentaje con mínimo, por producto (digital, tapa blanda, tapa dura), desde el admin.
 */
export const MARGIN_MODES = ['fixed', 'percent', 'percent_min'] as const;

export const marginModeSchema = z.enum(MARGIN_MODES);

export type MarginMode = z.infer<typeof marginModeSchema>;

export const marginSchema = z.object({
  mode: marginModeSchema,
  /** Margen fijo (modo `fixed`) o mínimo (modo `percent_min`), en centavos de USD. */
  fixedUsdMinor: z.number().int().min(0),
  /** Porcentaje del costo (modos `percent` y `percent_min`). */
  percent: z.number().min(0).max(1000),
});

export type Margin = z.infer<typeof marginSchema>;

/** productPricing/{producto}: costos y márgenes de un producto (editable en el admin). */
export const productPricingSchema = z.object({
  product: bookFormatSchema,
  /** Costo de IA por página ilustrada, con regeneraciones y revisión (centavos de USD). */
  aiCostPerPageUsdMinor: z.number().int().min(0),
  /** Margen sobre el costo de creación (IA). */
  creationMargin: marginSchema,
  /** Margen sobre lo que cobra la imprenta (solo impresos; el digital lo ignora). */
  printMargin: marginSchema,
  /** Profesionales: descuento base sobre el precio (aparte del de recurrencia). */
  proPercentOff: z.number().int().min(0).max(80).default(0),
  active: z.boolean(),
  updatedAt: z.date(),
});

export type ProductPricing = z.infer<typeof productPricingSchema>;

/**
 * Valores de fábrica: USD 0,15 de IA por página, USD 17 de creación y, en impresos, 30 % de la
 * imprenta con un mínimo de USD 8. Digital clásico (28 páginas): 4,20 + 17 = 21,99.
 */
const CREATION: Margin = { mode: 'fixed', fixedUsdMinor: 1700, percent: 0 };
const PRINTING: Margin = { mode: 'percent_min', fixedUsdMinor: 800, percent: 30 };

export const DEFAULT_PRODUCT_PRICING: Record<BookFormat, Omit<ProductPricing, 'updatedAt'>> = {
  digital: {
    product: 'digital',
    aiCostPerPageUsdMinor: 15,
    creationMargin: CREATION,
    printMargin: PRINTING,
    proPercentOff: 10,
    active: true,
  },
  softcover: {
    product: 'softcover',
    aiCostPerPageUsdMinor: 15,
    creationMargin: CREATION,
    printMargin: PRINTING,
    proPercentOff: 10,
    active: true,
  },
  hardcover: {
    product: 'hardcover',
    aiCostPerPageUsdMinor: 15,
    creationMargin: CREATION,
    printMargin: PRINTING,
    proPercentOff: 10,
    active: true,
  },
};

/** Margen sobre un costo (en centavos de USD), según su modo. */
export function marginUsdMinor(margin: Margin, costUsdMinor: number): number {
  const percent = Math.round((costUsdMinor * margin.percent) / 100);
  switch (margin.mode) {
    case 'fixed':
      return margin.fixedUsdMinor;
    case 'percent':
      return percent;
    case 'percent_min':
      return Math.max(percent, margin.fixedUsdMinor);
  }
}

/**
 * Precio unitario del libro en centavos de USD: creación (IA por páginas + margen) e impresión
 * (imprenta + margen, si es impreso). El envío va aparte y al costo.
 */
export function unitPriceUsdMinor(
  pricing: ProductPricing | Omit<ProductPricing, 'updatedAt'>,
  productionCostUsdMinor: number,
  pages: number,
): number {
  const ai = pricing.aiCostPerPageUsdMinor * Math.max(0, pages);
  const creation = ai + marginUsdMinor(pricing.creationMargin, ai);
  const printing =
    pricing.product === 'digital' || productionCostUsdMinor <= 0
      ? 0
      : productionCostUsdMinor + marginUsdMinor(pricing.printMargin, productionCostUsdMinor);
  return creation + printing;
}

/** Centavos de USD → unidad mínima de otra moneda (tipo de cambio: unidades por dólar). */
export function fromUsdMinor(usdMinor: number, currency: Currency, fx: FxRates): number | null {
  const rate = currency === 'USD' ? 1 : fx.rates[currency];
  if (!rate) return null;
  return Math.round((usdMinor / 100) * rate * 10 ** CURRENCY_MINOR_UNITS[currency]);
}

/**
 * Precio "lindo" para mostrar: hacia arriba, terminado en ,99 (o en 900 si la moneda no usa
 * decimales: CLP). Nunca baja el precio: el margen queda igual o un poco mayor.
 */
export function charmPrice(minor: number, currency: Currency): number {
  if (minor <= 0) return 0;
  if (CURRENCY_MINOR_UNITS[currency] === 0) {
    return Math.ceil((minor + 100) / 1000) * 1000 - 100;
  }
  return Math.ceil((minor + 1) / 100) * 100 - 1;
}
