import { LOCALES, LOCALE_DEFINITIONS, type Locale } from '@storynido/shared';
import type { Metadata } from 'next';

import { getPathname } from '@/i18n/navigation';

import { absoluteUrl } from './site';

type Href = Parameters<typeof getPathname>[0]['href'];

/**
 * URL canónica y alternativas por idioma (hreflang) de una página.
 * `hrefFor` permite que el slug cambie según el idioma (p. ej. documentos legales).
 */
export function localizedAlternates(
  locale: Locale,
  hrefFor: (locale: Locale) => Href,
): Metadata['alternates'] {
  const url = (target: Locale) =>
    absoluteUrl(getPathname({ locale: target, href: hrefFor(target) }));
  return {
    canonical: url(locale),
    languages: {
      ...Object.fromEntries(
        LOCALES.map((target) => [LOCALE_DEFINITIONS[target].bcp47, url(target)]),
      ),
      'x-default': url('es'),
    },
  };
}
