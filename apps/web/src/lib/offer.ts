import type { BookFormat, BookLength, CountryCode, Locale, Offer } from '@storynido/shared';

import { formatPrice } from './format';

/**
 * Precio más bajo de la oferta, formateado ("desde $349.00"). Con las extensiones que admite una
 * historia, parte de la más corta de ellas (un libro de bebé no cuesta lo de una gran aventura).
 */
export function lowestPrice(
  offer: Offer | null,
  locale: Locale,
  country: CountryCode,
  lengths?: readonly BookLength[],
  /** Precio del perfil profesional (con su descuento base). */
  pro = false,
): string | null {
  if (!offer?.available) return null;
  const prices =
    pro && offer.proLengthPrices.length > 0 ? offer.proLengthPrices : offer.lengthPrices;
  const byLength = (lengths ? prices.filter((item) => lengths.includes(item.length)) : prices).map(
    (item) => item.amountMinor,
  );
  const lowest = byLength.length
    ? Math.min(...byLength)
    : Math.min(...offer.formats.map((f) => f.amountMinor));
  return Number.isFinite(lowest) ? formatPrice(lowest, offer.currency, locale, country) : null;
}

/**
 * Precios para el hero: el digital exacto y el impreso "desde" (sin envío, que se cotiza con la
 * dirección), en dólares.
 */
export function offerHighlights(
  offer: Offer | null,
  locale: Locale,
  country: CountryCode,
): { digital: string | null; printed: string | null } | null {
  if (!offer?.available) return null;
  const money = (minor: number) => formatPrice(minor, offer.currency, locale, country);
  const digital = offer.formats.find((f) => f.format === 'digital');
  // El digital «desde» es el más bajo que de verdad se puede pagar (la extensión más corta), el
  // mismo que muestran las tarjetas del catálogo.
  const digitalFrom = offer.lengthPrices.length
    ? Math.min(...offer.lengthPrices.map((item) => item.amountMinor))
    : digital?.amountMinor;
  // El impreso «desde»: el formato más barato en su extensión más corta (sin envío).
  const printed = offer.formats
    .filter((f) => f.format !== 'digital')
    .sort((a, b) => a.amountMinor - b.amountMinor)[0];
  return {
    digital: digitalFrom === undefined ? null : money(digitalFrom),
    printed: printed ? money(printed.amountMinor) : null,
  };
}

/** Lo que la web necesita de la oferta para dar el precio de un libro ya elegido. */
export type BookPriceSource = Pick<Offer, 'lengthPrices' | 'proLengthPrices' | 'printLengthPrices'>;

/**
 * Precio exacto de un libro de esa extensión (sin envío), el mismo que el checkout: el digital y
 * el impreso más barato (`printedFormats` > 1: hay más de una tapa, el impreso va con «desde»).
 * `professional`: cuentas profesionales, con su descuento base.
 */
export function bookPrices(
  source: BookPriceSource,
  length: BookLength,
  professional = false,
): {
  digital: number | null;
  printed: number | null;
  printedFormats: BookFormat[];
} {
  const digital = (professional ? source.proLengthPrices : source.lengthPrices).find(
    (item) => item.length === length,
  );
  const printed = source.printLengthPrices
    .filter((item) => item.length === length)
    .map((item) => ({
      format: item.format,
      amountMinor: professional ? item.proAmountMinor : item.amountMinor,
    }))
    .sort((a, b) => a.amountMinor - b.amountMinor);
  return {
    digital: digital?.amountMinor ?? null,
    printed: printed[0]?.amountMinor ?? null,
    printedFormats: printed.map((item) => item.format),
  };
}
