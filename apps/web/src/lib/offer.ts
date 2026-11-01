import type { BookLength, CountryCode, Locale, Offer } from '@storynido/shared';

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
): string | null {
  if (!offer?.available) return null;
  const byLength = (
    lengths
      ? offer.lengthPrices.filter((item) => lengths.includes(item.length))
      : offer.lengthPrices
  ).map((item) => item.amountMinor);
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
  const printed = offer.formats
    .filter((f) => f.format !== 'digital')
    .sort((a, b) => a.amountMinor - b.amountMinor)[0];
  return {
    digital: digitalFrom === undefined ? null : money(digitalFrom),
    printed: printed ? money(printed.amountMinor) : null,
  };
}
