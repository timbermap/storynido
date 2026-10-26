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
