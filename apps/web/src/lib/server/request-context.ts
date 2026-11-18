import 'server-only';

import type { CountryCode, Locale } from '@storynido/shared';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';

import {
  COUNTRY_CHOICE_COOKIE,
  detectCountry,
  parseCountry,
  resolveDisplayCountry,
} from '../country';
import { getActiveCountries } from './api';
import { clientIp, countryFromIp } from './geoip';

/** País por la ubicación del visitante (IP) en esta request, sin mirar lo elegido a mano. */
export async function detectedCountry(locale: Locale): Promise<CountryCode> {
  const requestHeaders = await headers();
  return detectCountry(requestHeaders, locale, countryFromIp(clientIp(requestHeaders)));
}

/** País elegido a mano en este navegador ("Enviar a", Mi cuenta, el pago o la cuenta guardada). */
export async function chosenCountry(): Promise<CountryCode | null> {
  return parseCountry((await cookies()).get(COUNTRY_CHOICE_COOKIE)?.value);
}

/** País preferido del visitante: el elegido a mano o, si no, el de su IP en esta request. */
export async function preferredCountry(locale: Locale): Promise<CountryCode> {
  return (await chosenCountry()) ?? (await detectedCountry(locale));
}

export interface DisplayCountry {
  /** País cuyos precios se muestran. */
  country: CountryCode;
  /** Países donde se vende hoy. */
  activeCountries: CountryCode[];
  /** El país preferido no está disponible y se muestra otro. */
  fallback: boolean;
  preferred: CountryCode;
  /** País por la ubicación (IP), para ofrecer volver a él. */
  detected: CountryCode;
  /** El país lo eligió la persona (no salió de la ubicación). */
  chosen: boolean;
}

/** País con el que se muestran precios en esta request (deduplicado con cache de React). */
export const getDisplayCountry = cache(async (locale: Locale): Promise<DisplayCountry> => {
  const [chosen, detected] = await Promise.all([chosenCountry(), detectedCountry(locale)]);
  const preferred = chosen ?? detected;
  const activeCountries = (await getActiveCountries()).map((c) => c.code);
  const { country, fallback } = resolveDisplayCountry(preferred, activeCountries, locale);
  return { country, activeCountries, fallback, preferred, detected, chosen: chosen !== null };
});
