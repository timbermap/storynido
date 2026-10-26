import { DEFAULT_LOCALE, LOCALES } from '@storynido/shared';
import { defineRouting } from 'next-intl/routing';

/**
 * Rutas por idioma (/es, /en, /pt) con slugs traducidos.
 * Las carpetas de `app/[locale]` usan los nombres internos (izquierda).
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  localeCookie: { name: 'sn_locale', maxAge: 60 * 60 * 24 * 365 },
  pathnames: {
    '/': '/',
    '/stories': { es: '/historias', en: '/stories', pt: '/historias' },
    '/stories/[slug]': { es: '/historias/[slug]', en: '/stories/[slug]', pt: '/historias/[slug]' },
    '/blog': '/blog',
    '/blog/[slug]': '/blog/[slug]',
    '/legal/[document]': '/legal/[document]',
    '/login': { es: '/ingresar', en: '/login', pt: '/entrar' },
    '/login/finish': { es: '/ingresar/confirmar', en: '/login/finish', pt: '/entrar/confirmar' },
    '/account': { es: '/cuenta', en: '/account', pt: '/conta' },
  },
});

export type AppPathname = keyof typeof routing.pathnames;
