import type { CountryCode, Locale, Offer } from '@storynido/shared';

import { formatPrice, localReference } from './format';

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

/**
 * Precios para el hero: el digital exacto y el impreso "desde" (sin envío, que se cotiza con la
 * dirección), más la referencia en la moneda local si la hay ("≈ ARS 30.000").
 */
export function offerHighlights(
  offer: Offer | null,
  locale: Locale,
  country: CountryCode,
): { digital: string | null; printed: string | null; reference: string | null } | null {
  if (!offer?.available) return null;
  const money = (minor: number) => formatPrice(minor, offer.currency, locale, country);
  const digital = offer.formats.find((f) => f.format === 'digital');
  const printed = offer.formats
    .filter((f) => f.format !== 'digital')
    .sort((a, b) => a.amountMinor - b.amountMinor)[0];
  const cheapest = digital ?? printed;
  return {
    digital: digital ? money(digital.amountMinor) : null,
    printed: printed ? money(printed.amountMinor) : null,
    reference: cheapest ? localReference(cheapest.amountMinor, offer.local, locale, country) : null,
  };
}
