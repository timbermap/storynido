'use client';

import type { ComponentProps, ReactNode } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type Href = ComponentProps<typeof Link>['href'];

/** Enlace del menú a la landing de un público; queda marcado en la página donde estás. */
export function NavLink({
  href,
  children,
  className,
}: {
  href: '/families' | '/events' | '/professionals';
  children: ReactNode;
  className?: string;
}) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-2 whitespace-nowrap transition-colors hover:text-primary aria-[current=page]:text-primary',
        className,
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Botón de crear del encabezado: en la landing de un público lleva a su creador; en la home baja
 * a "¿Para quién es?" (cada público termina en su propio "Crear su cuento").
 */
export function HeaderCta({
  children,
  size = 'sm',
  className,
}: {
  children: ReactNode;
  size?: 'sm' | 'default';
  className?: string;
}) {
  const pathname = usePathname();
  const href: Href =
    pathname === '/'
      ? { pathname: '/', hash: 'audience' }
      : pathname === '/events'
        ? { pathname: '/create', query: { line: 'events' } }
        : pathname === '/professionals'
          ? { pathname: '/create', query: { line: 'professionals' } }
          : pathname === '/families'
            ? { pathname: '/create', query: { line: 'families' } }
            : // Fuera de una landing no se sabe qué quiere crear: se pregunta.
              '/new';
  return (
    <Link href={href} className={buttonVariants({ size, className })}>
      {children}
    </Link>
  );
}
