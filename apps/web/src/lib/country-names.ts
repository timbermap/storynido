import {
  COUNTRY_CODES,
  LOCALE_DEFINITIONS,
  type CountryCode,
  type Locale,
} from '@storynido/shared';

const cache = new Map<Locale, Intl.DisplayNames>();

/** Nombre de un país en el idioma del sitio (sale de Intl: los 249 países sin traducir a mano). */
export function countryName(code: CountryCode, locale: Locale): string {
  let names = cache.get(locale);
  if (!names) {
    names = new Intl.DisplayNames([LOCALE_DEFINITIONS[locale].bcp47], { type: 'region' });
    cache.set(locale, names);
  }
  return names.of(code) ?? code;
}

/** Todos los países, ordenados por nombre en ese idioma (para los selectores). */
export function countriesByName(locale: Locale): { code: CountryCode; name: string }[] {
  const collator = new Intl.Collator(LOCALE_DEFINITIONS[locale].bcp47);
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code, locale) })).sort((a, b) =>
    collator.compare(a.name, b.name),
  );
}
