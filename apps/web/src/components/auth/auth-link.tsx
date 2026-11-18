'use client';

import type { ComponentProps, ReactNode } from 'react';

import { Link } from '@/i18n/navigation';

import { useAuth } from './auth-provider';
import { useStartFreeHref } from './start-free';

/**
 * Botón de entrada a crear: sin sesión lleva siempre al login ("Empezar a crear…") y, una vez
 * dentro, la persona cae en Mis cuentos (no en el formulario del cuento). Con sesión sigue directo
 * a `href` (la enseñanza o la historia que eligió). Con `startFree` («Empezar gratis»), después de
 * entrar va al creador (DECISIONS 251).
 */
export function AuthLink({
  href,
  guest,
  member,
  className,
  startFree = false,
  ...rest
}: {
  href: ComponentProps<typeof Link>['href'];
  guest: ReactNode;
  member: ReactNode;
  className?: string;
  startFree?: boolean;
  'data-track'?: string;
  'data-track-line'?: string;
}) {
  const { signedIn } = useAuth();
  const startFreeHref = useStartFreeHref();
  return (
    <Link
      href={signedIn ? href : startFree ? startFreeHref : '/login'}
      className={className}
      {...rest}
    >
      {signedIn ? member : guest}
    </Link>
  );
}
