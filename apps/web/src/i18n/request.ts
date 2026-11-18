import type { Locale } from '@storynido/shared';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { locale as rootLocale } from 'next/root-params';

import { preferredCountry } from '@/lib/server/request-context';

import { routing } from './routing';
import { mergeMessages, usesVoseo } from './voseo';

type Messages = Parameters<typeof mergeMessages>[0];

/** País del visitante, o null fuera de una request (build, generación estática). */
async function visitorCountry(locale: Locale) {
  try {
    return await preferredCountry(locale);
  } catch {
    return null;
  }
}

export default getRequestConfig(async ({ locale: explicit }) => {
  // Un locale explícito (p. ej. getTranslations({ locale })) tiene prioridad sobre el de la URL.
  const requested = explicit ?? (await rootLocale());
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const messages = ((await import(`../../messages/${locale}.json`)) as { default: Messages })
    .default;
  // Argentina y Uruguay leen el sitio con voseo (DECISIONS 250).
  if (usesVoseo(locale, await visitorCountry(locale))) {
    const voseo = ((await import('../../messages/es-voseo.json')) as { default: Messages }).default;
    return { locale, messages: mergeMessages(messages, voseo) };
  }
  return { locale, messages };
});
