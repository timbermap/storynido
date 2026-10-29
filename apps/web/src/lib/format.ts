import {
  formatMoney,
  intlLocale,
  type CountryCode,
  type Currency,
  type Locale,
} from '@storynido/shared';

export function formatPrice(
  amountMinor: number,
  currency: Currency,
  locale: Locale,
  country: CountryCode,
): string {
  return formatMoney({ amountMinor, currency }, intlLocale(locale, country));
}

export function formatDate(date: Date | string, locale: Locale, country: CountryCode): string {
  return new Intl.DateTimeFormat(intlLocale(locale, country), { dateStyle: 'long' }).format(
    new Date(date),
  );
}

/**
 * Referencia en la moneda local ("≈ MXN 373") de un monto en dólares: todo se cobra en USD
 * (DECISIONS 097) y la moneda local es solo orientativa, sin decimales.
 */
export function localReference(
  usdMinor: number,
  local: { currency: Currency; rate: number } | null | undefined,
  locale: Locale,
  country: CountryCode,
): string | null {
  if (!local) return null;
  const units = Math.round((usdMinor / 100) * local.rate);
  const formatted = new Intl.NumberFormat(intlLocale(locale, country), {
    style: 'currency',
    currency: local.currency,
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  }).format(units);
  return `≈ ${formatted}`;
}
