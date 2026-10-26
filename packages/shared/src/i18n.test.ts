import { describe, expect, it } from 'vitest';

import { COUNTRY_CODES, COUNTRY_DEFAULTS } from './countries';
import { LOCALES, LOCALE_DEFINITIONS, isLocale, localesForCountry } from './i18n';

describe('i18n', () => {
  it('cada locale tiene definición coherente', () => {
    for (const locale of LOCALES) {
      expect(LOCALE_DEFINITIONS[locale].locale).toBe(locale);
    }
  });

  it('cada país tiene al menos un locale', () => {
    for (const country of COUNTRY_CODES) {
      expect(localesForCountry(country).length).toBeGreaterThan(0);
    }
  });

  it('el idioma por defecto de cada país tiene un locale para ese país', () => {
    for (const country of COUNTRY_CODES) {
      const languages = localesForCountry(country).map((l) => LOCALE_DEFINITIONS[l].language);
      expect(languages).toContain(COUNTRY_DEFAULTS[country].defaultLanguage);
    }
  });

  it('EE. UU. ofrece inglés y español', () => {
    expect(localesForCountry('US')).toEqual(['en-us', 'es-us']);
  });

  it('valida segmentos de ruta', () => {
    expect(isLocale('pt-br')).toBe(true);
    expect(isLocale('fr-fr')).toBe(false);
  });
});
