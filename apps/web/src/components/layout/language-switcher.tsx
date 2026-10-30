'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useTransition } from 'react';

import { LOCALES, LOCALE_DEFINITIONS, type Locale } from '@storynido/shared';

import { usePathname, useRouter } from '@/i18n/navigation';
import { LEGAL_SLUGS, legalDocumentFromSlug } from '@/lib/legal';
import { rememberLocaleChoice } from '@/lib/locale-choice';

/**
 * Cambiar de idioma manteniendo la página (con su slug traducido). Recuerda la elección: desde
 * ahí manda sobre el idioma del país de la IP.
 */
export function useLocaleSwitch() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const params = useParams<{
    slug?: string;
    document?: string;
    bookId?: string;
    orderId?: string;
  }>();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: Locale) {
    rememberLocaleChoice(next);
    startTransition(() => {
      if (pathname === '/legal/[document]') {
        const doc = legalDocumentFromSlug(locale, params.document ?? '');
        router.replace(doc ? { pathname, params: { document: LEGAL_SLUGS[next][doc] } } : '/', {
          locale: next,
        });
      } else if (pathname === '/blog/[slug]') {
        // Los artículos no tienen el mismo slug en cada idioma: se va al índice del blog.
        router.replace('/blog', { locale: next });
      } else if (pathname === '/create/[bookId]' || pathname === '/checkout/[bookId]') {
        router.replace({ pathname, params: { bookId: params.bookId ?? '' } }, { locale: next });
      } else if (pathname === '/order/[orderId]') {
        router.replace({ pathname, params: { orderId: params.orderId ?? '' } }, { locale: next });
      } else if (pathname === '/stories/[slug]' || pathname === '/lessons/[slug]') {
        router.replace({ pathname, params: { slug: params.slug ?? '' } }, { locale: next });
      } else {
        router.replace(pathname, { locale: next });
      }
    });
  }

  return { locale, change, pending };
}

/** Selector de idioma del pie de página. */
export function LanguageSwitcher({
  id,
  selectClassName,
}: {
  id: string;
  /** Estilo del select (por ejemplo, sobre el pie oscuro). */
  selectClassName?: string;
}) {
  const t = useTranslations('Switchers');
  const { locale, change, pending } = useLocaleSwitch();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{t('language')}</span>
      <select
        id={id}
        value={locale}
        disabled={pending}
        onChange={(event) => {
          change(event.target.value as Locale);
        }}
        className={
          selectClassName ??
          'h-10 rounded-full border border-border bg-card px-3 text-sm font-semibold text-foreground'
        }
      >
        {LOCALES.map((code) => (
          <option key={code} value={code} lang={LOCALE_DEFINITIONS[code].bcp47}>
            {LOCALE_DEFINITIONS[code].label}
          </option>
        ))}
      </select>
    </label>
  );
}
