import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest } from 'next/server';

import { isLocale, localeForCountry, localeFromAcceptLanguage } from '@storynido/shared';

import { routing } from './i18n/routing';
import {
  COUNTRY_CHOICE_COOKIE,
  COUNTRY_COOKIE,
  COUNTRY_COOKIE_MAX_AGE,
  detectCountry,
  parseCountry,
} from './lib/country';
import { LOCALE_CHOICE_COOKIE } from './lib/locale-choice';
import { clientIp, countryFromIp } from './lib/server/geoip';

const intl = createIntlMiddleware(routing);

/** Buscadores y vistas previas al compartir: siempre reciben el idioma por defecto en `/`. */
const CRAWLER =
  /googlebot|bingbot|duckduckbot|yandex|baiduspider|facebookexternalhit|whatsapp|twitterbot|linkedinbot|pinterestbot/i;

/**
 * Idioma en la URL (redirige / a /es, /en o /pt) y país detectado la primera vez. Sin idioma
 * elegido, el idioma sale del país de la IP (Argentina → español, Brasil → portugués, el resto
 * → inglés); si no se sabe, del navegador. Elegirlo a mano (pie, cuenta o aviso) tiene
 * prioridad. Visitar una página en otro idioma no cambia nada (DECISIONS 122).
 */
export default function proxy(request: NextRequest) {
  const segment = request.nextUrl.pathname.split('/')[1] ?? '';
  const hasLocale = isLocale(segment);
  // Con país elegido a mano no se detecta nada; si no, se detecta (y se renueva) por la IP.
  const needsCountry = !parseCountry(request.cookies.get(COUNTRY_CHOICE_COOKIE)?.value);
  const choice = request.cookies.get(LOCALE_CHOICE_COOKIE)?.value;
  const chosen = choice && isLocale(choice) ? choice : null;
  const needsLocale = !hasLocale;
  const ipCountry =
    needsCountry || (needsLocale && !chosen) ? countryFromIp(clientIp(request.headers)) : null;

  // Idioma por IP; si la IP daría inglés pero el navegador pide español o portugués (hispanos en
  // EE. UU.), manda el navegador. Los rastreadores (Googlebot sale de EE. UU.) van a /es.
  const browserLocale = localeFromAcceptLanguage(request.headers.get('accept-language'));
  const byIp = needsLocale && !chosen ? localeForCountry(ipCountry) : null;
  const isCrawler = CRAWLER.test(request.headers.get('user-agent') ?? '');
  const ipLocale =
    byIp === null
      ? null
      : isCrawler
        ? routing.defaultLocale
        : byIp === 'en' && (browserLocale === 'es' || browserLocale === 'pt')
          ? browserLocale
          : byIp;
  const target = needsLocale ? (chosen ?? ipLocale) : null;
  const response = intl(target ? withLanguage(request, target) : request);

  if (needsCountry) {
    const locale = hasLocale ? segment : (ipLocale ?? routing.defaultLocale);
    const detected = detectCountry(request.headers, locale, ipCountry);
    // Solo se escribe si cambió: no se renueva la cookie en cada página.
    if (request.cookies.get(COUNTRY_COOKIE)?.value !== detected) {
      response.cookies.set(COUNTRY_COOKIE, detected, {
        maxAge: COUNTRY_COOKIE_MAX_AGE,
        sameSite: 'lax',
        path: '/',
      });
    }
  }

  return response;
}

/** La misma request, con el idioma del país primero en Accept-Language (lo usa next-intl). */
function withLanguage(request: NextRequest, locale: string): NextRequest {
  const headers = new Headers(request.headers);
  const current = headers.get('accept-language');
  headers.set('accept-language', current ? `${locale},${current}` : locale);
  return new NextRequest(request, { headers });
}

export const config = {
  // Todo menos archivos estáticos, _next y rutas internas.
  // /__/auth: el login de Firebase que se sirve desde el propio dominio (ver next.config).
  matcher: '/((?!api|_next|_vercel|__/auth|.*\\..*).*)',
};
