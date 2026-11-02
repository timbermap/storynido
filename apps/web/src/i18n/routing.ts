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
  // Sin cookie automática: next-intl la guardaba al visitar cualquier página en un idioma y desde
  // ahí ignoraba la IP. La elección a mano la guarda la web (lib/locale-choice).
  localeCookie: false,
  pathnames: {
    '/': '/',
    // Solo desarrollo: la home con sesión con datos de prueba (da 404 en producción).
    '/dev-home': '/dev-home',
    // Líneas comerciales: una landing por público (DECISIONS 102).
    '/families': { es: '/familias', en: '/families', pt: '/familias' },
    '/events': { es: '/eventos', en: '/events', pt: '/eventos' },
    '/professionals': { es: '/profesionales', en: '/professionals', pt: '/profissionais' },
    // Un catálogo por línea (estudio de catálogo): Familias, Celebraciones y Profesionales.
    '/families/stories': {
      es: '/familias/historias',
      en: '/families/stories',
      pt: '/familias/historias',
    },
    '/events/themes': { es: '/eventos/tematicas', en: '/events/themes', pt: '/eventos/temas' },
    '/professionals/templates': {
      es: '/profesionales/plantillas',
      en: '/professionals/templates',
      pt: '/profissionais/modelos',
    },
    '/stories': { es: '/historias', en: '/stories', pt: '/historias' },
    '/stories/[slug]': { es: '/historias/[slug]', en: '/stories/[slug]', pt: '/historias/[slug]' },
    '/lessons': { es: '/ensenanzas', en: '/lessons', pt: '/licoes' },
    '/lessons/[slug]': { es: '/ensenanzas/[slug]', en: '/lessons/[slug]', pt: '/licoes/[slug]' },
    '/blog': '/blog',
    '/blog/[slug]': '/blog/[slug]',
    '/legal/[document]': '/legal/[document]',
    '/login': { es: '/ingresar', en: '/login', pt: '/entrar' },
    '/login/finish': { es: '/ingresar/confirmar', en: '/login/finish', pt: '/entrar/confirmar' },
    '/account': { es: '/cuenta', en: '/account', pt: '/conta' },
    '/my-stories': { es: '/mis-cuentos', en: '/my-stories', pt: '/minhas-historias' },
    '/my-orders': { es: '/mis-pedidos', en: '/my-orders', pt: '/meus-pedidos' },
    '/my-stories/characters/[childId]': {
      es: '/mis-cuentos/personajes/[childId]',
      en: '/my-stories/characters/[childId]',
      pt: '/minhas-historias/personagens/[childId]',
    },
    '/create': { es: '/crear', en: '/create', pt: '/criar' },
    '/new': { es: '/nuevo', en: '/new', pt: '/novo' },
    '/faq': { es: '/preguntas-frecuentes', en: '/faq', pt: '/perguntas-frequentes' },
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
