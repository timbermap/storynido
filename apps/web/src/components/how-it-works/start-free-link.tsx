'use client';

import { ArrowRight } from 'lucide-react';

import { useAuth } from '@/components/auth/auth-provider';
import { useStartFreeHref } from '@/components/auth/start-free';
import { Link } from '@/i18n/navigation';

/**
 * «Empezar gratis» de la página Cómo funciona: sin sesión lleva a ingresar y, después, al creador,
 * igual que el resto de los «Empezar gratis» (DECISIONS 252); con sesión, directo a elegir qué crear.
 */
export function StartFreeLink({
  label,
  memberLabel,
  track,
  className,
}: {
  label: string;
  memberLabel: string;
  /** Evento de medición (data-track) para saber desde qué bloque se empezó. */
  track: string;
  className?: string;
}) {
  const { signedIn } = useAuth();
  const startFree = useStartFreeHref();
  return (
    <Link href={signedIn ? '/new' : startFree} data-track={track} className={className}>
      {signedIn ? memberLabel : label}
      <ArrowRight aria-hidden="true" />
    </Link>
  );
}
