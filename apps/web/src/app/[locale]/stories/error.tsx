'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { reportClientError } from '@/lib/client-errors';

export default function StoriesError({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('Stories');
  useEffect(() => {
    reportClientError(error, 'boundary');
  }, [error]);
  const tError = useTranslations('Error');
  return (
    <section className="container-page flex min-h-[50vh] flex-col items-center justify-center gap-4 py-20 text-center">
      <p className="text-lg text-muted-foreground">{t('error')}</p>
      <Button onClick={reset}>{tError('retry')}</Button>
    </section>
  );
}
