'use client';

import type { ComponentProps, ReactNode } from 'react';

import { Link } from '@/i18n/navigation';

import { useAuth } from './auth-provider';

/**
 * Botón de entrada a crear: sin sesión lleva siempre al login ("Empezar a crear…") y, una vez
 * dentro, la persona cae en Mis cuentos (no en el formulario del cuento). Con sesión sigue directo
 * a `href` (la enseñanza o la historia que eligió).
 */
export function AuthLink({
  href,
  guest,
  member,
  className,
}: {
  href: ComponentProps<typeof Link>['href'];
  guest: ReactNode;
  member: ReactNode;
  className?: string;
}) {
  const { signedIn } = useAuth();
  return (
    <Link href={signedIn ? href : '/login'} className={className}>
      {signedIn ? member : guest}
    </Link>
  );
}
