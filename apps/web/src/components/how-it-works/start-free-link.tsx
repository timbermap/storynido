'use client';

import { ArrowRight } from 'lucide-react';

import { useAuth } from '@/components/auth/auth-provider';
import { Link } from '@/i18n/navigation';

/**
 * «Empezar gratis» de la página Cómo funciona: sin sesión lleva a ingresar (crear la cuenta es
 * gratis); con sesión, directo a elegir qué crear.
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
  return (
    <Link href={signedIn ? '/new' : '/login'} data-track={track} className={className}>
      {signedIn ? memberLabel : label}
      <ArrowRight aria-hidden="true" />
    </Link>
  );
}
