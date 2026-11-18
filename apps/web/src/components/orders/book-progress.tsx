'use client';

import type { PublicOrder } from '@storynido/shared';
import { useTranslations } from 'next-intl';

import { ProgressBar } from '@/components/ui/generation-progress';

type Progress = NonNullable<PublicOrder['progress']>;

/**
 * Avance del libro completo mientras se crea (DECISIONS 261): en qué etapa va, cuántas páginas
 * ya están ilustradas y cuánto suele faltar, con los tiempos reales de los últimos libros.
 */
export function BookProgressView({ progress }: { progress: Progress }) {
  const t = useTranslations('Generation.book');
  const minutes = Math.ceil(progress.remainingSeconds / 60);
  const stage =
    progress.stage === 'illustrations' && progress.pagesTotal
      ? t('pages', { done: progress.pagesDone ?? 0, total: progress.pagesTotal })
      : t(`stages.${progress.stage}`);
  let eta: string;
  if (progress.late) eta = t('late');
  else if (minutes <= 1) eta = t('almost');
  else eta = t('remaining', { minutes });
  return (
    <section aria-labelledby="book-progress" className="grid gap-3 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="book-progress" className="font-semibold">
          {stage}
        </h2>
        <p className="text-sm font-semibold text-muted-foreground">{eta}</p>
      </div>
      <ProgressBar fraction={progress.fraction} label={t('label')} />
      <p className="text-sm text-muted-foreground">{t('leave')}</p>
    </section>
  );
}
