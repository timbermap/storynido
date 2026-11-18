'use client';

import type { ReactNode } from 'react';

import { useStartFreeHref } from '@/components/auth/start-free';
import { buttonVariants } from '@/components/ui/button';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

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
 * Botón de crear del encabezado (sin sesión), con el texto de la sección: «Empezar gratis» lleva a
 * ingresar y de ahí al creador, igual que el hero (DECISIONS 252); "Diseñar el kit" en
 * Celebraciones y "Probar gratis" en Profesionales arrancan el creador en su línea.
 */
export function HeaderCta({
  children,
  eventsLabel,
  professionalsLabel,
  size = 'sm',
  className,
}: {
  children: ReactNode;
  eventsLabel?: ReactNode;
  professionalsLabel?: ReactNode;
  size?: 'sm' | 'default';
  className?: string;
}) {
  const pathname = usePathname();
  const inEvents = pathname.startsWith('/events') && Boolean(eventsLabel);
  const inProfessionals = pathname.startsWith('/professionals') && Boolean(professionalsLabel);
  const label = inEvents ? eventsLabel : inProfessionals ? professionalsLabel : children;
  const line = inEvents ? 'events' : inProfessionals ? 'professionals' : undefined;
  const startFree = useStartFreeHref();
  return (
    <Link
      href={line ? { pathname: '/create', query: { line } } : startFree}
      className={buttonVariants({ size, className })}
    >
      {label}
    </Link>
  );
}
