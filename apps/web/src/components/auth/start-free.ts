'use client';

import { useLocale } from 'next-intl';

import { getPathname } from '@/i18n/navigation';

/**
 * Destino de «Empezar gratis» sin sesión (DECISIONS 252): ingresar y, después de entrar, la portada
 * del creador. Lo comparten el menú, el hero, el botón fijo del celular y el cierre.
 */
export function useStartFreeHref() {
  const locale = useLocale();
  return {
    pathname: '/login',
    query: { next: getPathname({ locale, href: '/create' }) },
  } as const;
}
