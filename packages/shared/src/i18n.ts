import { z } from 'zod';

import type { CountryCode } from './countries';

export const LANGUAGES = ['es', 'en', 'pt-BR'] as const;

export const languageSchema = z.enum(LANGUAGES);

export type Language = z.infer<typeof languageSchema>;

/** Segmentos de ruta localizados (`/es-mx`, `/en-us`, ...). */
export const LOCALES = [
  'es-mx',
  'en-us',
  'es-us',
  'es-es',
  'es-co',
  'es-cl',
  'es-pe',
  'pt-br',
] as const;

export const localeSchema = z.enum(LOCALES);

export type Locale = z.infer<typeof localeSchema>;

export const DEFAULT_LOCALE: Locale = 'es-mx';

export interface LocaleDefinition {
  locale: Locale;
  language: Language;
  country: CountryCode;
  /** Etiqueta BCP 47 para Intl y `hreflang`. */
  bcp47: string;
}

export const LOCALE_DEFINITIONS: Record<Locale, LocaleDefinition> = {
  'es-mx': { locale: 'es-mx', language: 'es', country: 'MX', bcp47: 'es-MX' },
  'en-us': { locale: 'en-us', language: 'en', country: 'US', bcp47: 'en-US' },
  'es-us': { locale: 'es-us', language: 'es', country: 'US', bcp47: 'es-US' },
  'es-es': { locale: 'es-es', language: 'es', country: 'ES', bcp47: 'es-ES' },
  'es-co': { locale: 'es-co', language: 'es', country: 'CO', bcp47: 'es-CO' },
  'es-cl': { locale: 'es-cl', language: 'es', country: 'CL', bcp47: 'es-CL' },
  'es-pe': { locale: 'es-pe', language: 'es', country: 'PE', bcp47: 'es-PE' },
  'pt-br': { locale: 'pt-br', language: 'pt-BR', country: 'BR', bcp47: 'pt-BR' },
};

export function isLocale(value: string): value is Locale {
  return localeSchema.safeParse(value).success;
}

export function localesForCountry(country: CountryCode): Locale[] {
  return LOCALES.filter((locale) => LOCALE_DEFINITIONS[locale].country === country);
}
