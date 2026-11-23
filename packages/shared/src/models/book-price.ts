import { REFERENCE_CURRENCIES, type CountryCode } from '../countries';
import type { Currency } from '../currency';
import type { CountryConfig } from './commerce';
import { BOOK_FORMATS, type BookFormat } from './common';
import type { FxRates } from './metrics';
import { CHARGE_CURRENCY } from './pricing';
import { printAvailability, printPageCount, type PrintOption } from './print';
import {
  aiCostUsdMinor,
  charmPrice,
  minNetMarginUsdMinor,
  unitPriceUsdMinor,
  withBookPaymentFee,
  type ProductPricing,
} from './product-pricing';

/**
 * Precios claros (DECISIONS 241): el precio de un libro se calcula en un solo lugar. La barra de
 * la muestra, las tarjetas del checkout y el resumen usan estas funciones con las páginas reales
 * del libro y el costo real de la imprenta, así que muestran el mismo número. El margen es fijo:
 * si sube un costo (imprenta o IA), sube el precio.
 */

type Pricing = ProductPricing | Omit<ProductPricing, 'updatedAt'>;

/**
 * Costo de impresión de un ejemplar según la matriz (admin, actualizada a diario con las
 * cotizaciones de las imprentas): la imprenta habilitada más barata que puede imprimir ese
 * formato y esas páginas en el país. Es el respaldo cuando no hay cotización en vivo. Null si
 * ninguna imprenta activa puede.
 */
export function referencePrintCost(
  options: readonly PrintOption[],
  format: BookFormat,
  interiorPages: number,
  activeProviders: readonly string[],
  quantity = 1,
): { productionUsdMinor: number; etaDaysMin: number; etaDaysMax: number } | null {
  if (format === 'digital') return null;
  const pages = printPageCount(format, interiorPages);
  const usable = options.filter(
    (option) =>
      option.format === format &&
      activeProviders.includes(option.provider) &&
      printAvailability(option, pages, quantity).ok,
  );
  if (usable.length === 0) return null;
  return {
    productionUsdMinor: Math.min(...usable.map((option) => option.productionCostUsdMinor)),
    etaDaysMin: Math.min(...usable.map((option) => option.etaDaysMin)),
    etaDaysMax: Math.max(...usable.map((option) => option.etaDaysMax)),
  };
}

/**
 * Precio de un ejemplar del libro, sin envío, en centavos de USD (DECISIONS 241): costo +
 * márgenes, más la comisión de cobro, redondeado a ,99 hacia arriba. Una cuenta profesional paga
 * con el descuento base del producto, sin bajar nunca del margen neto mínimo. `pages`: páginas
 * con ilustración generada. `minPages` (DECISIONS 246): las del cuento mini; ningún ebook, ni con
 * el descuento profesional, baja del precio de lista del ebook mini.
 */
export function bookPriceMinor(
  pricing: Pricing,
  productionUsdMinor: number,
  pages: number,
  professional = false,
  minPages?: number,
  /** Páginas con ilustración generada (IA); por defecto, `pages` (DECISIONS 246). */
  aiPages = pages,
): number {
  const gross = withBookPaymentFee(
    pricing,
    unitPriceUsdMinor(pricing, productionUsdMinor, pages, aiPages),
  );
  const discounted = professional
    ? Math.round((gross * (100 - pricing.proPercentOff)) / 100)
    : gross;
  return charmPrice(
    Math.max(
      discounted,
      proLadderMinor(pricing, gross, professional, minPages),
      bookFloorMinor(pricing, productionUsdMinor, aiPages),
      ebookMinimumMinor(pricing, minPages),
    ),
    CHARGE_CURRENCY,
  );
}

/**
 * Escalera del precio profesional de un ebook: el descuento no puede dejar a una extensión más
 * larga al mismo precio que la mini (con 10 % off, Corto caía al piso y salía igual que Mini).
 * Mantiene la mitad del escalón de lista sobre el piso del mini. 0 si no es profesional, no es
 * ebook o no hay `minPages`.
 */
export function proLadderMinor(
  pricing: Pricing,
  gross: number,
  professional: boolean,
  minPages?: number,
): number {
  if (!professional || pricing.product !== 'digital' || minPages === undefined) return 0;
  const miniGross = withBookPaymentFee(pricing, unitPriceUsdMinor(pricing, 0, minPages));
  return miniGross + Math.max(0, Math.round((gross - miniGross) / 2));
}

/**
 * Lo mínimo que se cobra por un ebook (DECISIONS 246): el precio de lista del ebook mini
 * (`minPages`, sus páginas generadas), hoy US$ 13,99. Ni el descuento profesional ni un cupón
 * bajan de acá (el cobro digital no acepta menos). 0 en los impresos o sin `minPages`.
 */
export function ebookMinimumMinor(pricing: Pricing, minPages?: number): number {
  if (pricing.product !== 'digital' || minPages === undefined) return 0;
  return charmPrice(
    withBookPaymentFee(pricing, unitPriceUsdMinor(pricing, 0, minPages)),
    CHARGE_CURRENCY,
  );
}

/**
 * Lo mínimo que se puede cobrar por un ejemplar del libro con descuentos: costos + margen neto
 * mínimo + comisión. Ningún cupón, promoción ni descuento profesional baja de acá.
 */
export function bookFloorMinor(
  pricing: Pricing,
  productionUsdMinor: number,
  pages: number,
): number {
  const production = pricing.product === 'digital' ? 0 : Math.max(0, productionUsdMinor);
  return withBookPaymentFee(
    pricing,
    aiCostUsdMinor(pricing, pages) + production + minNetMarginUsdMinor(pricing),
  );
}

/**
 * Costo estable de impresión (DECISIONS 241): el precio cambia solo si el costo se mueve más de
 * 5 %. Si la cotización en vivo está a 5 % o menos del costo de la matriz, se usa el de la matriz.
 */
export function stablePrintCost(liveUsdMinor: number, matrixUsdMinor: number | null): number {
  if (matrixUsdMinor === null || matrixUsdMinor <= 0) return liveUsdMinor;
  return Math.abs(liveUsdMinor - matrixUsdMinor) <= matrixUsdMinor * 0.05
    ? matrixUsdMinor
    : liveUsdMinor;
}

/**
 * Precio exacto del libro (sin envío) en cada formato que se puede comprar en el país, para un
 * libro con `pages` páginas generadas. `productionUsdMinor` da el costo de impresión por ejemplar
 * de cada formato impreso (null: no se puede imprimir). El orden es el de `BOOK_FORMATS`.
 */
export function bookFormatPrices(input: {
  country: CountryConfig | null;
  pricing: Partial<Record<BookFormat, Pricing>>;
  pages: number;
  productionUsdMinor: (format: BookFormat) => number | null;
  professional?: boolean;
  /** Formatos a considerar (por defecto, todos). */
  formats?: readonly BookFormat[];
  /** Páginas generadas del cuento mini: el piso del ebook (DECISIONS 246). */
  minPages?: number;
  /** Páginas con ilustración generada (IA), si son menos que `pages` (DECISIONS 246). */
  aiPages?: number;
}): { format: BookFormat; amountMinor: number }[] {
  const { country } = input;
  if (!country?.active) return [];
  return (input.formats ?? BOOK_FORMATS).flatMap((format) => {
    const pricing = input.pricing[format];
    if (!country.formats[format] || !pricing?.active) return [];
    const production = format === 'digital' ? 0 : input.productionUsdMinor(format);
    if (production === null) return [];
    return [
      {
        format,
        amountMinor: bookPriceMinor(
          pricing,
          production,
          input.pages,
          input.professional,
          input.minPages,
          input.aiPages,
        ),
      },
    ];
  });
}

/**
 * Moneda local de referencia de un país (todo se cobra en dólares): la suya o, si cobra en
 * dólares, la de la región. Null si no tiene o no hay tipo de cambio.
 */
export function referenceCurrency(
  code: CountryCode,
  country: Pick<CountryConfig, 'currency'>,
  fx: FxRates,
): { currency: Currency; rate: number } | null {
  const currency =
    country.currency !== CHARGE_CURRENCY ? country.currency : REFERENCE_CURRENCIES[code];
  const rate = currency ? fx.rates[currency] : undefined;
  return currency && rate ? { currency, rate } : null;
}

/** Costo por ejemplar de la matriz para una imprenta (la fila del país o, si no, la global). */
export function matrixCostFor(
  options: readonly PrintOption[],
  format: BookFormat,
  provider: string,
  country: CountryCode,
): number | null {
  const rows = options.filter((option) => option.provider === provider && option.format === format);
  const row = rows.find((option) => option.country === country) ?? rows[0];
  return row ? row.productionCostUsdMinor : null;
}
