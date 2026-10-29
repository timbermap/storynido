import { z } from 'zod';

import { CURRENCY_MINOR_UNITS, type Currency } from '../currency';
import { bookFormatSchema, type BookFormat } from './common';
import { bookLengthSchema, type BookLength } from './editorial';
import type { FxRates } from './metrics';

/**
 * Precio por costo + margen (DECISIONS 096). Cada producto (digital, tapa blanda, tapa dura) tiene
 * su margen, que el admin define como monto fijo, porcentaje del costo o porcentaje con mínimo.
 * El impreso se cotiza con cada pedido: imprenta más barata para esa dirección + margen; el envío
 * se cobra al costo. Todo se calcula en dólares y se convierte a la moneda del comprador.
 */
export const MARGIN_MODES = ['fixed', 'percent', 'percent_min'] as const;

export const marginModeSchema = z.enum(MARGIN_MODES);

export type MarginMode = z.infer<typeof marginModeSchema>;

/** productPricing/{producto}: margen y costos propios de un producto (editable en el admin). */
export const productPricingSchema = z.object({
  product: bookFormatSchema,
  /** Costo propio aparte de la imprenta (digital: IA y PDF), en centavos de USD. */
  baseCostUsdMinor: z.number().int().min(0),
  marginMode: marginModeSchema,
  /** Margen fijo (modo `fixed`) o mínimo (modo `percent_min`), en centavos de USD. */
  marginFixedUsdMinor: z.number().int().min(0),
  /** Margen en porcentaje del costo (modos `percent` y `percent_min`). */
  marginPercent: z.number().min(0).max(1000),
  /** Ajuste por extensión, en centavos de USD (Mini más barato, Gran aventura más caro). */
  lengthAdjustmentsUsdMinor: z.partialRecord(bookLengthSchema, z.number().int()).default({}),
  /** Profesionales: descuento base sobre el precio (aparte del de recurrencia). */
  proPercentOff: z.number().int().min(0).max(80).default(0),
  active: z.boolean(),
  updatedAt: z.date(),
});

export type ProductPricing = z.infer<typeof productPricingSchema>;

/**
 * Valores por defecto (monto fijo): con la imprenta más barata de EE. UU. dejan los precios
 * cerca de los de lanzamiento (digital USD 19,99; tapa blanda ~39,99 y dura ~49,99 con envío).
 */
export const DEFAULT_PRODUCT_PRICING: Record<BookFormat, Omit<ProductPricing, 'updatedAt'>> = {
  digital: {
    product: 'digital',
    baseCostUsdMinor: 100,
    marginMode: 'fixed',
    marginFixedUsdMinor: 1899,
    marginPercent: 0,
    lengthAdjustmentsUsdMinor: { mini: -300, epic: 600 },
    proPercentOff: 10,
    active: true,
  },
  softcover: {
    product: 'softcover',
    baseCostUsdMinor: 100,
    marginMode: 'fixed',
    marginFixedUsdMinor: 2700,
    marginPercent: 0,
    lengthAdjustmentsUsdMinor: { mini: -300, epic: 600 },
    proPercentOff: 10,
    active: true,
  },
  hardcover: {
    product: 'hardcover',
    baseCostUsdMinor: 100,
    marginMode: 'fixed',
    marginFixedUsdMinor: 2800,
    marginPercent: 0,
    lengthAdjustmentsUsdMinor: { mini: -300, epic: 600 },
    proPercentOff: 10,
    active: true,
  },
};

/** Margen sobre un costo (en centavos de USD), según el modo del producto. */
export function marginUsdMinor(
  pricing: Pick<ProductPricing, 'marginMode' | 'marginFixedUsdMinor' | 'marginPercent'>,
  costUsdMinor: number,
): number {
  const percent = Math.round((costUsdMinor * pricing.marginPercent) / 100);
  switch (pricing.marginMode) {
    case 'fixed':
      return pricing.marginFixedUsdMinor;
    case 'percent':
      return percent;
    case 'percent_min':
      return Math.max(percent, pricing.marginFixedUsdMinor);
  }
}

/**
 * Precio unitario del libro en centavos de USD: costo propio + impresión (si es impreso) +
 * margen + ajuste por extensión. El envío va aparte y al costo.
 */
export function unitPriceUsdMinor(
  pricing: ProductPricing | Omit<ProductPricing, 'updatedAt'>,
  productionCostUsdMinor: number,
  length: BookLength | null,
): number {
  const cost = pricing.baseCostUsdMinor + productionCostUsdMinor;
  const adjustment = length ? (pricing.lengthAdjustmentsUsdMinor[length] ?? 0) : 0;
  return Math.max(0, cost + marginUsdMinor(pricing, cost) + adjustment);
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
