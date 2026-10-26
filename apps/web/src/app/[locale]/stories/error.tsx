'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

export default function StoriesError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('Stories');
  const tError = useTranslations('Error');
  return (
    <section className="container-page flex min-h-[50vh] flex-col items-center justify-center gap-4 py-20 text-center">
      <p className="text-lg text-muted-foreground">{t('error')}</p>
      <Button onClick={reset}>{tError('retry')}</Button>
    </section>
  );
}
