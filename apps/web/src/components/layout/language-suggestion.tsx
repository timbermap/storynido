'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { localeForCountry, type Locale } from '@storynido/shared';

import { usePathname } from '@/i18n/navigation';
import { COUNTRY_CHOICE_COOKIE, COUNTRY_COOKIE } from '@/lib/country';
import { LOCALE_CHOICE_COOKIE, readCookie, rememberLocaleChoice } from '@/lib/locale-choice';

import { isFocusPath } from './focus-header';
import { useLocaleSwitch } from './language-switcher';

/** En el idioma sugerido: quien llega desde ese país lo lee mejor que el de la página. */
const COPY: Record<Locale, { text: string; cta: string; close: string }> = {
  es: { text: 'Este sitio también está en español.', cta: 'Ver en español', close: 'Cerrar' },
  en: { text: 'This site is also in English.', cta: 'View in English', close: 'Close' },
  pt: { text: 'Este site também está em português.', cta: 'Ver em português', close: 'Fechar' },
};

/**
 * Quien abre un link en otro idioma (por ejemplo, en inglés desde Argentina) ve una sugerencia
 * con el idioma de su país. Elegir o cerrar queda recordado y no vuelve a aparecer.
 */
export function LanguageSuggestion() {
  const pathname = usePathname();
  const { locale, change } = useLocaleSwitch();
  const [suggested, setSuggested] = useState<Locale | null>(null);

  useEffect(() => {
    // Las cookies se leen después de montar (la página se sirve igual para todos).
    if (readCookie(LOCALE_CHOICE_COOKIE)) return;
    const fromCountry = localeForCountry(
      readCookie(COUNTRY_CHOICE_COOKIE) ?? readCookie(COUNTRY_COOKIE),
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fromCountry && fromCountry !== locale) setSuggested(fromCountry);
  }, [locale]);

  if (!suggested || isFocusPath(pathname)) return null;
  const copy = COPY[suggested];
  return (
    <div
      lang={suggested}
      className="border-b bg-secondary text-sm"
      role="region"
      aria-label={copy.text}
    >
      <div className="container-page flex min-h-11 items-center justify-center gap-3 py-1.5">
        <span>{copy.text}</span>
        <button
          type="button"
          className="min-h-9 rounded-full px-3 font-semibold text-primary underline-offset-4 hover:underline"
          onClick={() => {
            change(suggested);
          }}
        >
          {copy.cta}
        </button>
        <button
          type="button"
          aria-label={copy.close}
          className="grid size-9 place-items-center rounded-full hover:bg-white/60"
          onClick={() => {
            // Cerrar es quedarse en este idioma: queda elegido.
            rememberLocaleChoice(locale);
            setSuggested(null);
          }}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
