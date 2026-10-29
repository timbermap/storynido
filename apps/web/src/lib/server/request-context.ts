import 'server-only';

import type { CountryCode, Locale } from '@storynido/shared';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';

import { COUNTRY_COOKIE, detectCountry, parseCountry, resolveDisplayCountry } from '../country';
import { getActiveCountries } from './api';
import { clientIp, countryFromIp } from './geoip';

/** País preferido del visitante (cookie que fija el proxy o el selector). */
export async function preferredCountry(locale: Locale): Promise<CountryCode> {
  const fromCookie = parseCountry((await cookies()).get(COUNTRY_COOKIE)?.value);
  if (fromCookie) return fromCookie;
  const requestHeaders = await headers();
  return detectCountry(requestHeaders, locale, countryFromIp(clientIp(requestHeaders)));
}

export interface DisplayCountry {
  /** País cuyos precios se muestran. */
  country: CountryCode;
  /** Países donde se vende hoy. */
  activeCountries: CountryCode[];
  /** El país preferido no está disponible y se muestra otro. */
  fallback: boolean;
  preferred: CountryCode;
}

/** País con el que se muestran precios en esta request (deduplicado con cache de React). */
export const getDisplayCountry = cache(async (locale: Locale): Promise<DisplayCountry> => {
  const preferred = await preferredCountry(locale);
  const activeCountries = (await getActiveCountries()).map((c) => c.code);
  const { country, fallback } = resolveDisplayCountry(preferred, activeCountries, locale);
  return { country, activeCountries, fallback, preferred };
});
