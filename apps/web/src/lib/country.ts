import {
  LOCALE_DEFINITIONS,
  countryCodeSchema,
  countryFromAcceptLanguage,
  type CountryCode,
  type Locale,
} from '@storynido/shared';

export const COUNTRY_COOKIE = 'sn_country';
export const COUNTRY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Headers de país que agregan las CDN o balanceadores comunes. En Google Cloud se
 * configura con un header personalizado del balanceador (`X-Client-Country: {client_region}`).
 */
const GEO_HEADERS = [
  'x-client-country',
  'x-appengine-country',
  'cf-ipcountry',
  'x-vercel-ip-country',
] as const;

export function parseCountry(value: string | null | undefined): CountryCode | null {
  const parsed = countryCodeSchema.safeParse(value?.trim().toUpperCase());
  return parsed.success ? parsed.data : null;
}

/**
 * País por IP (header de la infraestructura o la base local de IP), por idioma del navegador o
 * por idioma del sitio. `ipCountry` lo calcula el servidor con `countryFromIp`.
 */
export function detectCountry(
  headers: Pick<Headers, 'get'>,
  locale: Locale,
  ipCountry: string | null = null,
): CountryCode {
  for (const header of GEO_HEADERS) {
    const country = parseCountry(headers.get(header));
    if (country) return country;
  }
  const byIp = parseCountry(ipCountry);
  if (byIp) return byIp;
  return (
    countryFromAcceptLanguage(headers.get('accept-language')) ??
    LOCALE_DEFINITIONS[locale].defaultCountry
  );
}

/**
 * País para mostrar precios: el preferido si se vende ahí; si no, el país principal del idioma
 * o el primero disponible. `fallback` indica que no se pudo usar el preferido.
 */
export function resolveDisplayCountry(
  preferred: CountryCode,
  activeCountries: readonly CountryCode[],
  locale: Locale,
): { country: CountryCode; fallback: boolean } {
  if (activeCountries.includes(preferred)) return { country: preferred, fallback: false };
  const byLocale = LOCALE_DEFINITIONS[locale].defaultCountry;
  if (activeCountries.includes(byLocale)) return { country: byLocale, fallback: true };
  const first = activeCountries[0];
  return first ? { country: first, fallback: true } : { country: preferred, fallback: false };
}
