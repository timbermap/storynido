'use client';

import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { SignInPanel } from '@/components/auth/sign-in-panel';

/** El creador pide sesión: guarda el borrador y protege las fotos del menor. */
export function SignInGate({ title, text }: { title?: string; text?: string } = {}) {
  const t = useTranslations('Wizard');
  return (
    <section className="container-page flex max-w-md flex-col gap-8 py-14">
      <header className="space-y-3 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </span>
        <h1 className="text-3xl font-semibold">{title ?? t('signInTitle')}</h1>
        <p className="text-muted-foreground">{text ?? t('signInText')}</p>
      </header>
      <SignInPanel />
    </section>
  );
}
