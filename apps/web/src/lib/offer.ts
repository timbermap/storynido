import type { CountryCode, Locale, Offer } from '@storynido/shared';

import { formatPrice } from './format';

/** Precio más bajo de la oferta, formateado ("desde $349.00"). */
export function lowestPrice(
  offer: Offer | null,
  locale: Locale,
  country: CountryCode,
): string | null {
  if (!offer?.available) return null;
  const lowest = Math.min(...offer.formats.map((f) => f.amountMinor));
  return Number.isFinite(lowest) ? formatPrice(lowest, offer.currency, locale, country) : null;
}
