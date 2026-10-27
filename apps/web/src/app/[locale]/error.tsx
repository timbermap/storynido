'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('Error');
  return (
    <section className="container-page flex min-h-[60vh] flex-col items-center justify-center gap-4 py-20 text-center">
      <h1 className="text-3xl font-medium">{t('title')}</h1>
      <p className="text-muted-foreground">{t('text')}</p>
      <Button onClick={reset}>{t('retry')}</Button>
    </section>
  );
}
