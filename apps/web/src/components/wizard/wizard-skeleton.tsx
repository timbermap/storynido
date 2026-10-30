'use client';

import { useTranslations } from 'next-intl';

/**
 * Mientras se prepara el creador: la forma del asistente (progreso, título y campos) en vez de
 * una pantalla vacía. El texto queda para lectores de pantalla.
 */
export function WizardSkeleton() {
  const t = useTranslations('Wizard');
  return (
    <div className="container-page max-w-3xl py-10" aria-busy="true">
      <p role="status" className="sr-only">
        {t('loading')}
      </p>
      <div aria-hidden="true" className="animate-pulse">
        <div className="h-5 w-40 rounded-full bg-muted" />
        <div className="mt-4 h-2.5 rounded-full bg-secondary" />
        <div className="mt-8 grid gap-6 rounded-xl border bg-card p-6 sm:p-8">
          <div className="h-9 w-3/4 rounded-lg bg-muted" />
          <div className="h-4 w-1/2 rounded bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-12 rounded-xl bg-muted" />
            <div className="h-12 rounded-xl bg-muted" />
          </div>
          <div className="h-24 rounded-xl bg-muted" />
          <div className="ml-auto h-11 w-36 rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}
