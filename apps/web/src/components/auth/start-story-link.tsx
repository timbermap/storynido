'use client';

import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { AnchorLink } from '@/components/anchor-link';
import { useLatestDraft } from '@/components/layout/use-account-activity';
import { Link } from '@/i18n/navigation';

import { useAuth } from './auth-provider';

/**
 * "Empezar mi cuento" de la home. Sin sesión lleva al login (y de ahí a Mis cuentos). Con sesión
 * ya no se vende nada: si hay un borrador, "Continuar mi cuento"; si no, "Crear otro cuento", que
 * baja a "¿Para quién es?" para elegir la línea.
 */
export function StartStoryLink({
  target,
  className,
  memberLabel,
  continueLabel,
  children,
}: {
  target: string;
  className?: string;
  memberLabel: string;
  continueLabel: string;
  children: ReactNode;
}) {
  const { signedIn } = useAuth();
  const draft = useLatestDraft();
  if (!signedIn) {
    return (
      <Link href="/login" className={className}>
        {children}
        <ArrowRight aria-hidden="true" />
      </Link>
    );
  }
  if (draft) {
    return (
      <Link
        href={{ pathname: '/create/[bookId]', params: { bookId: draft.id } }}
        className={className}
      >
        {continueLabel}
        <ArrowRight aria-hidden="true" />
      </Link>
    );
  }
  return (
    <AnchorLink target={target} className={className}>
      {memberLabel}
      <ArrowRight aria-hidden="true" className="rotate-90" />
    </AnchorLink>
  );
}
