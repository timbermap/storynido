import createIntlMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';

import { isLocale } from '@storynido/shared';

import { routing } from './i18n/routing';
import { COUNTRY_COOKIE, COUNTRY_COOKIE_MAX_AGE, detectCountry, parseCountry } from './lib/country';

const intl = createIntlMiddleware(routing);

/** Idioma en la URL (redirige / a /es, /en o /pt) y país detectado la primera vez. */
export default function proxy(request: NextRequest) {
  const response = intl(request);

  if (!parseCountry(request.cookies.get(COUNTRY_COOKIE)?.value)) {
    const segment = request.nextUrl.pathname.split('/')[1] ?? '';
    const locale = isLocale(segment) ? segment : routing.defaultLocale;
    response.cookies.set(COUNTRY_COOKIE, detectCountry(request.headers, locale), {
      maxAge: COUNTRY_COOKIE_MAX_AGE,
      sameSite: 'lax',
      path: '/',
    });
  }

  return response;
}

export const config = {
  // Todo menos archivos estáticos, _next y rutas internas.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
