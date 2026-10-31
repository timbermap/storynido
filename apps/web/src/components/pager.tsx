'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

/** Paginación simple (Anterior / Siguiente) para las listas de Mis cuentos. */
export function Pager({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  const t = useTranslations('Pager');
  if (pages <= 1) return null;
  return (
    <nav aria-label={t('label')} className="flex items-center justify-between gap-3">
      <Button
        size="sm"
        variant="outline"
        disabled={page === 0}
        onClick={() => {
          onChange(page - 1);
        }}
      >
        {t('previous')}
      </Button>
      <span className="text-sm text-muted-foreground" aria-live="polite">
        {t('status', { page: page + 1, pages })}
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={page >= pages - 1}
        onClick={() => {
          onChange(page + 1);
        }}
      >
        {t('next')}
      </Button>
    </nav>
  );
}
