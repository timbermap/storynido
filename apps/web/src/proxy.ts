import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest } from 'next/server';

import { isLocale, localeForCountry } from '@storynido/shared';

import { routing } from './i18n/routing';
import { COUNTRY_COOKIE, COUNTRY_COOKIE_MAX_AGE, detectCountry, parseCountry } from './lib/country';
import { clientIp, countryFromIp } from './lib/server/geoip';

const intl = createIntlMiddleware(routing);
const LOCALE_COOKIE = 'sn_locale';

/**
 * Idioma en la URL (redirige / a /es, /en o /pt) y país detectado la primera vez. Sin idioma
 * elegido, el idioma sale del país de la IP (Argentina → español, Brasil → portugués, el resto
 * → inglés); si no se sabe, del navegador. Elegirlo en el footer o en la cuenta tiene prioridad.
 */
export default function proxy(request: NextRequest) {
  const segment = request.nextUrl.pathname.split('/')[1] ?? '';
  const hasLocale = isLocale(segment);
  const needsCountry = !parseCountry(request.cookies.get(COUNTRY_COOKIE)?.value);
  const needsLocale = !hasLocale && !request.cookies.has(LOCALE_COOKIE);
  const ipCountry = needsCountry || needsLocale ? countryFromIp(clientIp(request.headers)) : null;

  const ipLocale = needsLocale ? localeForCountry(ipCountry) : null;
  const response = intl(ipLocale ? withLanguage(request, ipLocale) : request);

  if (needsCountry) {
    const locale = hasLocale ? segment : (ipLocale ?? routing.defaultLocale);
    response.cookies.set(COUNTRY_COOKIE, detectCountry(request.headers, locale, ipCountry), {
      maxAge: COUNTRY_COOKIE_MAX_AGE,
      sameSite: 'lax',
      path: '/',
    });
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
