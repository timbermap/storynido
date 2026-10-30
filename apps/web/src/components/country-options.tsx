'use client';

import { useTranslations } from 'next-intl';

import type { CountryCode, Locale } from '@storynido/shared';

import { countriesByName, countryName } from '@/lib/country-names';

/** Los mercados principales, arriba de la lista (después del país detectado o elegido). */
const MAIN_MARKETS: readonly CountryCode[] = [
  'AR',
  'MX',
  'US',
  'ES',
  'CL',
  'CO',
  'UY',
  'PE',
  'BR',
] as CountryCode[];

/**
 * Opciones de país para un select: primero el actual y los mercados principales, después los
 * 250 en orden alfabético (escribir en el select salta al país).
 */
export function CountryOptions({ locale, current }: { locale: Locale; current?: CountryCode }) {
  const t = useTranslations('Switchers');
  const suggested = [...new Set([...(current ? [current] : []), ...MAIN_MARKETS])];
  return (
    <>
      <optgroup label={t('suggestedCountries')}>
        {suggested.map((code) => (
          <option key={`s-${code}`} value={code}>
            {countryName(code, locale)}
          </option>
        ))}
      </optgroup>
      <optgroup label={t('allCountries')}>
        {countriesByName(locale)
          .filter(({ code }) => !suggested.includes(code))
          .map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
      </optgroup>
    </>
  );
}
