'use client';

import type { ReactNode } from 'react';

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
 * Botón de crear del encabezado (sin sesión): lleva al login y de ahí a Mis cuentos (DECISIONS 144),
 * con el texto de la sección: "Crear vista previa gratis", "Diseñar el kit" en Celebraciones y
 * "Probar gratis" en Profesionales (reporte de navegación).
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
  const label =
    pathname.startsWith('/events') && eventsLabel
      ? eventsLabel
      : pathname.startsWith('/professionals') && professionalsLabel
        ? professionalsLabel
        : children;
  return (
    <Link href="/login" className={buttonVariants({ size, className })}>
      {label}
    </Link>
  );
}
