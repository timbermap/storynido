'use client';

import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { AnchorLink } from '@/components/anchor-link';
import { Link } from '@/i18n/navigation';

import { useAuth } from './auth-provider';

/**
 * "Empezar mi cuento" de la home: sin sesión lleva al login (y de ahí a Mis cuentos); con sesión
 * baja a "¿Para quién es?" para elegir la línea.
 */
export function StartStoryLink({
  target,
  className,
  children,
}: {
  target: string;
  className?: string;
  children: ReactNode;
}) {
  const { signedIn } = useAuth();
  if (!signedIn) {
    return (
      <Link href="/login" className={className}>
        {children}
        <ArrowRight aria-hidden="true" />
      </Link>
    );
  }
  return (
    <AnchorLink target={target} className={className}>
      {children}
      <ArrowRight aria-hidden="true" className="rotate-90" />
    </AnchorLink>
  );
}
