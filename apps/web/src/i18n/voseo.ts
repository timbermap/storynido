import type { CountryCode } from '@storynido/shared';

/**
 * Voseo rioplatense para Argentina y Uruguay (DECISIONS 250). El sitio en español usa «tú»; para
 * quien entra desde esos países, `messages/es-voseo.json` (generado con scripts/voseo/generar.py)
 * reemplaza solo los textos que cambian.
 */
export const VOSEO_COUNTRIES: readonly CountryCode[] = ['AR', 'UY'];

export function usesVoseo(locale: string, country: CountryCode | null | undefined): boolean {
  return locale === 'es' && !!country && VOSEO_COUNTRIES.includes(country);
}

interface Messages {
  [key: string]: string | Messages;
}

/** Copia de `base` con las claves de `overrides` encima (en profundidad). */
export function mergeMessages(base: Messages, overrides: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const current = out[key];
    out[key] =
      typeof value === 'object' && typeof current === 'object'
        ? mergeMessages(current, value)
        : value;
  }
  return out;
}
