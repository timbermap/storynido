'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { reportClientError } from '@/lib/client-errors';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('Error');
  useEffect(() => {
    reportClientError(error, 'boundary');
  }, [error]);
  return (
    <section className="container-page flex min-h-[60vh] flex-col items-center justify-center gap-4 py-20 text-center">
      <h1 className="text-3xl font-medium">{t('title')}</h1>
      <p className="text-muted-foreground">{t('text')}</p>
      <Button onClick={reset}>{t('retry')}</Button>
    </section>
  );
}
