import { REFERENCE_CURRENCIES, type CountryCode } from '../countries';
import type { Currency } from '../currency';
import type { CountryConfig } from './commerce';
import { BOOK_FORMATS, type BookFormat } from './common';
import type { FxRates } from './metrics';
import { CHARGE_CURRENCY } from './pricing';
import { printAvailability, printPageCount, type PrintOption } from './print';
import { charmPrice, unitPriceUsdMinor, type ProductPricing } from './product-pricing';

/**
 * Precios claros (DECISIONS 236): el precio de un libro se calcula en un solo lugar. La barra de
 * la muestra, las tarjetas del checkout y el resumen usan estas funciones con las páginas reales
 * del libro, así que muestran el mismo número.
 */

type Pricing = ProductPricing | Omit<ProductPricing, 'updatedAt'>;

/**
 * Costo de referencia de impresión de un ejemplar: la imprenta habilitada más barata de la matriz
 * (admin) que puede imprimir ese formato y esas páginas en el país. Es el costo con el que se
 * calcula el precio del impreso: la dirección no lo cambia (solo agrega el envío). Null si
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
 * Precio de un ejemplar del libro, sin envío, en centavos de USD: costo + márgenes, redondeado
 * a ,99. Una cuenta profesional paga con el descuento base del producto (antes de redondear).
 */
export function bookPriceMinor(
  pricing: Pricing,
  productionUsdMinor: number,
  pages: number,
  professional = false,
): number {
  const usd = unitPriceUsdMinor(pricing, productionUsdMinor, pages);
  const withBase = professional ? Math.round((usd * (100 - pricing.proPercentOff)) / 100) : usd;
  return charmPrice(withBase, CHARGE_CURRENCY);
}

/**
 * Precio exacto del libro (sin envío) en cada formato que se puede comprar en el país, para un
 * libro de `pages` páginas interiores. El orden es el de `BOOK_FORMATS`.
 */
export function bookFormatPrices(input: {
  country: CountryConfig | null;
  pricing: Partial<Record<BookFormat, Pricing>>;
  options: readonly PrintOption[];
  activeProviders: readonly string[];
  pages: number;
  professional?: boolean;
  /** Formatos a considerar (por defecto, todos). */
  formats?: readonly BookFormat[];
}): { format: BookFormat; amountMinor: number }[] {
  const { country } = input;
  if (!country?.active) return [];
  return (input.formats ?? BOOK_FORMATS).flatMap((format) => {
    const pricing = input.pricing[format];
    if (!country.formats[format] || !pricing?.active) return [];
    const print = referencePrintCost(input.options, format, input.pages, input.activeProviders);
    if (format !== 'digital' && !print) return [];
    return [
      {
        format,
        amountMinor: bookPriceMinor(
          pricing,
          print?.productionUsdMinor ?? 0,
          input.pages,
          input.professional,
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
