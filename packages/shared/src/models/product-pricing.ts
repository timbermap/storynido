import { z } from 'zod';

import { CURRENCY_MINOR_UNITS, type Currency } from '../currency';
import { bookFormatSchema, type BookFormat } from './common';
import type { FxRates } from './metrics';

/**
 * Precio por costo + dos márgenes (DECISIONS 096, 098 y 241), todo en dólares:
 * - creación: el costo de IA (costo por página × páginas con ilustración generada) + margen de
 *   creación (base + monto por página generada);
 * - impresión (solo impresos): lo que cobra la imprenta que se usa + margen de impresión.
 * La comisión de cobro es un costo: el precio se calcula para que, después de ella, quede el
 * margen. El envío se cobra al costo más su parte de la comisión. Cada margen se define desde el
 * admin, por producto (digital, tapa blanda, tapa dura, grapado).
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
  /** Modo `fixed`: además, un monto por página con ilustración generada (centavos de USD). */
  perPageUsdMinor: z.number().int().min(0).optional(),
  /** Modo `fixed`: margen mínimo por libro (un libro con pocas páginas generadas no baja de acá). */
  minUsdMinor: z.number().int().min(0).optional(),
});

export type Margin = z.infer<typeof marginSchema>;

/** productPricing/{producto}: costos y márgenes de un producto (editable en el admin). */
export const productPricingSchema = z.object({
  product: bookFormatSchema,
  /**
   * Costo de IA por página con ilustración generada (no cuentan las fijas ni las de actividades
   * que arma el sistema), con regeneraciones y revisión (centavos de USD).
   */
  aiCostPerPageUsdMinor: z.number().int().min(0),
  /** Margen sobre el costo de creación (IA). */
  creationMargin: marginSchema,
  /** Margen sobre lo que cobra la imprenta (solo impresos; el digital lo ignora). */
  printMargin: marginSchema,
  /** Profesionales: descuento base sobre el precio (aparte del de recurrencia). */
  proPercentOff: z.number().int().min(0).max(80).default(0),
  /** Comisión de cobro (Stripe, Mercado Pago), en %: un costo más. Sin valor, 3,5 %. */
  paymentFeePercent: z.number().min(0).max(20).optional(),
  /**
   * Margen neto mínimo por libro (después de costos y comisión): ningún descuento (cupón, pro,
   * recurrencia) lo perfora. Sin valor, USD 8 en digital y USD 12 en impresos.
   */
  minNetMarginUsdMinor: z.number().int().min(0).optional(),
  /**
   * Costo de IA por página medido (DECISIONS 241): un job diario lo calcula con los libros pagados
   * de los últimos 30 días y, salvo que esté fijado a mano, lo copia a `aiCostPerPageUsdMinor`.
   */
  aiCostAuto: z
    .object({
      perPageUsdMinor: z.number().int().nonnegative(),
      books: z.number().int().nonnegative(),
      updatedAt: z.coerce.date(),
      /** El valor que había antes de copiarlo (null si no se copió: pocos libros o fijado a mano). */
      previousUsdMinor: z.number().int().nonnegative().nullable(),
      /** Cuándo se copió por última vez (el precio cambia como mucho una vez por semana). */
      appliedAt: z.coerce.date().nullish(),
    })
    .nullish(),
  /** Fijar a mano: el job diario no toca `aiCostPerPageUsdMinor`. */
  aiCostManual: z.boolean().optional(),
  active: z.boolean(),
  updatedAt: z.date(),
});

export type ProductPricing = z.infer<typeof productPricingSchema>;

/**
 * Valores de fábrica (DECISIONS 241): USD 0,15 de IA por página generada; creación = USD 8 + 0,35
 * por página generada; impresión = 30 % de la imprenta con mínimo de USD 8 (USD 10 en tapa dura);
 * comisión de cobro 3,5 %. Ebook clásico (26 páginas generadas): (3,90 + 8 + 9,10) ÷ 0,965 =
 * 21,76 → 21,99.
 */
export const DEFAULT_PAYMENT_FEE_PERCENT = 3.5;
// Mínimo por libro: el del mini (8 + 10 páginas × 0,35 = 11,50).
const CREATION: Margin = {
  mode: 'fixed',
  fixedUsdMinor: 800,
  percent: 0,
  perPageUsdMinor: 35,
  minUsdMinor: 1150,
};
const PRINTING: Margin = { mode: 'percent_min', fixedUsdMinor: 800, percent: 30 };

const product = (format: BookFormat, printMin = 800) => ({
  product: format,
  aiCostPerPageUsdMinor: 15,
  creationMargin: CREATION,
  printMargin: { ...PRINTING, fixedUsdMinor: printMin },
  proPercentOff: 10,
  paymentFeePercent: DEFAULT_PAYMENT_FEE_PERCENT,
  minNetMarginUsdMinor: format === 'digital' ? 800 : 1200,
  active: true,
});

export const DEFAULT_PRODUCT_PRICING: Record<BookFormat, Omit<ProductPricing, 'updatedAt'>> = {
  digital: product('digital'),
  softcover: product('softcover'),
  hardcover: product('hardcover', 1000),
  // Cuento grapado (DECISIONS 138): el mínimo de USD 8 ya cubre su costo de producción.
  booklet: product('booklet'),
};

/** Margen sobre un costo (en centavos de USD), según su modo. `pages`: páginas generadas. */
export function marginUsdMinor(margin: Margin, costUsdMinor: number, pages = 0): number {
  const percent = Math.round((costUsdMinor * margin.percent) / 100);
  switch (margin.mode) {
    case 'fixed':
      return Math.max(
        margin.fixedUsdMinor + (margin.perPageUsdMinor ?? 0) * Math.max(0, pages),
        margin.minUsdMinor ?? 0,
      );
    case 'percent':
      return percent;
    case 'percent_min':
      return Math.max(percent, margin.fixedUsdMinor);
  }
}

type Pricing = ProductPricing | Omit<ProductPricing, 'updatedAt'>;

/** Costo de IA del libro: costo por página generada × páginas generadas. */
export const aiCostUsdMinor = (pricing: Pricing, pages: number) =>
  pricing.aiCostPerPageUsdMinor * Math.max(0, pages);

/**
 * Costo + márgenes de un ejemplar, en centavos de USD, antes de la comisión de cobro: creación
 * (IA por páginas generadas + margen) e impresión (imprenta + margen, si es impreso).
 */
export function unitPriceUsdMinor(
  pricing: Pricing,
  productionCostUsdMinor: number,
  pages: number,
): number {
  const ai = aiCostUsdMinor(pricing, pages);
  const creation = ai + marginUsdMinor(pricing.creationMargin, ai, pages);
  const printing =
    pricing.product === 'digital' || productionCostUsdMinor <= 0
      ? 0
      : productionCostUsdMinor + marginUsdMinor(pricing.printMargin, productionCostUsdMinor);
  return creation + printing;
}

/** Comisión de cobro del producto, en %. */
export const paymentFeePercent = (pricing: Pricing) =>
  pricing.paymentFeePercent ?? DEFAULT_PAYMENT_FEE_PERCENT;

/** Lo que hay que cobrar para que, después de la comisión, queden `usdMinor` (hacia arriba). */
export function withPaymentFee(usdMinor: number, feePercent: number): number {
  if (usdMinor <= 0) return 0;
  return Math.ceil((usdMinor * 100) / (100 - feePercent));
}

/** Margen neto mínimo por libro (lo que ningún descuento perfora). */
export const minNetMarginUsdMinor = (pricing: Pricing) =>
  pricing.minNetMarginUsdMinor ?? (pricing.product === 'digital' ? 800 : 1200);

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
