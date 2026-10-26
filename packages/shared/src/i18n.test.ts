import { describe, expect, it } from 'vitest';

import { COUNTRY_CODES, COUNTRY_DEFAULTS } from './countries';
import {
  LOCALES,
  LOCALE_DEFINITIONS,
  countryFromAcceptLanguage,
  intlLocale,
  isLocale,
  localeFromAcceptLanguage,
} from './i18n';

describe('i18n', () => {
  it('cada idioma tiene definición coherente', () => {
    for (const locale of LOCALES) expect(LOCALE_DEFINITIONS[locale].locale).toBe(locale);
  });

  it('el idioma por defecto de cada país es un idioma soportado', () => {
    for (const country of COUNTRY_CODES)
      expect(isLocale(COUNTRY_DEFAULTS[country].defaultLocale)).toBe(true);
  });

  it('valida segmentos de ruta', () => {
    expect(isLocale('pt')).toBe(true);
    expect(isLocale('es-mx')).toBe(false);
    expect(isLocale('fr')).toBe(false);
  });

  it('combina idioma y país para formatear', () => {
    expect(intlLocale('es', 'MX')).toBe('es-MX');
    expect(intlLocale('en', 'US')).toBe('en-US');
  });

  it('detecta idioma y país desde Accept-Language respetando la prioridad', () => {
    expect(localeFromAcceptLanguage('fr-FR,fr;q=0.9,en-US;q=0.8,es;q=0.7')).toBe('en');
    expect(localeFromAcceptLanguage('de-DE')).toBeNull();
    expect(countryFromAcceptLanguage('es-CO,es;q=0.9')).toBe('CO');
    expect(countryFromAcceptLanguage('en-GB,en;q=0.9')).toBeNull();
    expect(countryFromAcceptLanguage(null)).toBeNull();
  });
});
