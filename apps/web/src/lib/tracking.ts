import { LOCALES } from '@storynido/shared';

import { routing, type AppPathname } from '@/i18n/routing';

/**
 * Rutas donde nunca corre analítica ni publicidad, aunque haya consentimiento:
 * ahí se cargan datos y fotos del niño (creador), la cuenta y el acceso.
 */
const PRIVATE_PATHNAMES: AppPathname[] = [
  '/create',
  '/create/[bookId]',
  '/checkout/[bookId]',
  '/order/[orderId]',
  '/account',
  '/login',
  '/login/finish',
];

/** Primer segmento localizado de cada ruta privada ("/crear", "/create", "/criar"...). */
const PRIVATE_PREFIXES: string[] = [
  ...new Set(
    PRIVATE_PATHNAMES.flatMap((pathname) => {
      const localized = routing.pathnames[pathname];
      return LOCALES.map((locale) => {
        const path = typeof localized === 'string' ? localized : localized[locale];
        return `/${locale}/${path.split('/')[1] ?? ''}`;
      });
    }),
  ),
];

export function isPrivatePath(pathname: string): boolean {
  const path = pathname.toLowerCase().replace(/\/+$/, '');
  return PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Línea comercial de una página pública, para agrupar la analítica (sin datos personales). */
export function channelForPath(pathname: string): 'families' | 'events' | 'professionals' {
  const path = pathname.toLowerCase();
  const prefixes = (key: '/events' | '/professionals') => {
    const localized = routing.pathnames[key];
    return LOCALES.map(
      (locale) => `/${locale}${typeof localized === 'string' ? localized : localized[locale]}`,
    );
  };
  if (prefixes('/events').some((prefix) => path.startsWith(prefix))) return 'events';
  if (prefixes('/professionals').some((prefix) => path.startsWith(prefix))) return 'professionals';
  return 'families';
}
