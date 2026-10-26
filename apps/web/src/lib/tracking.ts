import { LOCALES } from '@storynido/shared';

import { routing, type AppPathname } from '@/i18n/routing';

/**
 * Rutas donde nunca corre analítica ni publicidad, aunque haya consentimiento:
 * ahí se cargan datos y fotos del niño (creador), la cuenta y el acceso.
 */
const PRIVATE_PATHNAMES: AppPathname[] = [
  '/create',
  '/create/[bookId]',
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
