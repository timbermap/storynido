import type { Locale } from '@storynido/shared';

/**
 * Idioma elegido a mano (pie de página, Mi cuenta o el aviso de idioma). Solo esta elección se
 * recuerda: visitar una página en otro idioma no cambia nada (DECISIONS 122). Sin elección, el
 * idioma sale del país de la IP.
 */
export const LOCALE_CHOICE_COOKIE = 'sn_lang';

export function rememberLocaleChoice(locale: Locale): void {
  document.cookie = `${LOCALE_CHOICE_COOKIE}=${locale}; path=/; max-age=${String(60 * 60 * 24 * 365)}; samesite=lax`;
}

export function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
