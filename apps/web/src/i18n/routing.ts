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
    // Líneas comerciales: una landing por público (DECISIONS 102).
    '/families': { es: '/familias', en: '/families', pt: '/familias' },
    '/events': { es: '/eventos', en: '/events', pt: '/eventos' },
    '/professionals': { es: '/profesionales', en: '/professionals', pt: '/profissionais' },
    '/stories': { es: '/historias', en: '/stories', pt: '/historias' },
    '/stories/[slug]': { es: '/historias/[slug]', en: '/stories/[slug]', pt: '/historias/[slug]' },
    '/lessons/[slug]': { es: '/ensenanzas/[slug]', en: '/lessons/[slug]', pt: '/licoes/[slug]' },
    '/blog': '/blog',
    '/blog/[slug]': '/blog/[slug]',
    '/legal/[document]': '/legal/[document]',
    '/login': { es: '/ingresar', en: '/login', pt: '/entrar' },
    '/login/finish': { es: '/ingresar/confirmar', en: '/login/finish', pt: '/entrar/confirmar' },
    '/account': { es: '/cuenta', en: '/account', pt: '/conta' },
    '/my-stories': { es: '/mis-cuentos', en: '/my-stories', pt: '/minhas-historias' },
    '/create': { es: '/crear', en: '/create', pt: '/criar' },
    '/create/[bookId]': { es: '/crear/[bookId]', en: '/create/[bookId]', pt: '/criar/[bookId]' },
    // Pago y pedido (la API arma la URL de vuelta del pago con estas mismas rutas).
    '/checkout/[bookId]': {
      es: '/pagar/[bookId]',
      en: '/checkout/[bookId]',
      pt: '/pagamento/[bookId]',
    },
    '/order/[orderId]': {
      es: '/pedido/[orderId]',
      en: '/order/[orderId]',
      pt: '/pedido/[orderId]',
    },
  },
});

export type AppPathname = keyof typeof routing.pathnames;
