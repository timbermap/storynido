import { z } from 'zod';

import { COUNTRY_CODES, type CountryCode } from './countries';

/**
 * Idiomas del sitio. Son el segmento de la URL (`/es`, `/en`, `/pt`) y el idioma del
 * contenido, los mails y la IA. El país (moneda, precio, envío) es un ajuste aparte.
 * `es` es español neutro (Latinoamérica y EE. UU.); `es-es` se agrega al lanzar España.
 */
export const LOCALES = ['es', 'en', 'pt'] as const;

export const localeSchema = z.enum(LOCALES);

export type Locale = z.infer<typeof localeSchema>;

export const DEFAULT_LOCALE: Locale = 'es';

export interface LocaleDefinition {
  locale: Locale;
  /** Etiqueta BCP 47 del idioma (atributo lang y hreflang). */
  bcp47: string;
  /** Nombre del idioma en ese idioma, para el selector. */
  label: string;
  /** País por defecto si no se puede detectar. */
  defaultCountry: CountryCode;
}

export const LOCALE_DEFINITIONS: Record<Locale, LocaleDefinition> = {
  es: { locale: 'es', bcp47: 'es', label: 'Español', defaultCountry: 'MX' },
  en: { locale: 'en', bcp47: 'en', label: 'English', defaultCountry: 'US' },
  pt: { locale: 'pt', bcp47: 'pt-BR', label: 'Português', defaultCountry: 'BR' },
};

export function isLocale(value: string): value is Locale {
  return localeSchema.safeParse(value).success;
}

/** Locale de Intl para formatear números, monedas y fechas según idioma y país (p. ej. es-MX). */
export function intlLocale(locale: Locale, country: CountryCode): string {
  return `${locale}-${country}`;
}

interface LanguageRange {
  language: string;
  region: string | null;
  quality: number;
}

function parseAcceptLanguage(header: string | null | undefined): LanguageRange[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      const [language = '', region] = tag.toLowerCase().split('-');
      return {
        language,
        region: region ? region.toUpperCase() : null,
        quality: q ? Number(q.trim().slice(2)) : 1,
      };
    })
    .filter((range) => range.language && range.language !== '*' && !Number.isNaN(range.quality))
    .sort((a, b) => b.quality - a.quality);
}

/** Idioma preferido según el header Accept-Language, si lo soportamos. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  for (const range of parseAcceptLanguage(header)) {
    if (isLocale(range.language)) return range.language;
  }
  return null;
}

/** País sugerido por la región del Accept-Language (es-MX → MX), si lo soportamos. */
export function countryFromAcceptLanguage(header: string | null | undefined): CountryCode | null {
  for (const range of parseAcceptLanguage(header)) {
    if (range.region && (COUNTRY_CODES as readonly string[]).includes(range.region)) {
      return range.region as CountryCode;
    }
  }
  return null;
}
