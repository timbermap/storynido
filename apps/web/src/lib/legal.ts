import type { Locale } from '@storynido/shared';

export const LEGAL_DOCUMENTS = ['terms', 'privacy', 'cookies', 'refunds', 'shipping'] as const;

export type LegalDocument = (typeof LEGAL_DOCUMENTS)[number];

/** Slug de cada documento legal por idioma (/es/legal/privacidad, /en/legal/privacy...). */
export const LEGAL_SLUGS: Record<Locale, Record<LegalDocument, string>> = {
  es: {
    terms: 'terminos',
    privacy: 'privacidad',
    cookies: 'cookies',
    refunds: 'reembolsos',
    shipping: 'envios',
  },
  en: {
    terms: 'terms',
    privacy: 'privacy',
    cookies: 'cookies',
    refunds: 'refunds',
    shipping: 'shipping',
  },
  pt: {
    terms: 'termos',
    privacy: 'privacidade',
    cookies: 'cookies',
    refunds: 'reembolsos',
    shipping: 'envios',
  },
};

export function legalDocumentFromSlug(locale: Locale, slug: string): LegalDocument | null {
  return LEGAL_DOCUMENTS.find((doc) => LEGAL_SLUGS[locale][doc] === slug) ?? null;
}
