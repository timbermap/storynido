import { getTranslations } from 'next-intl/server';

import { brand } from '@/lib/brand';

import { Logo } from './logo';

export async function Maintenance() {
  const t = await getTranslations('Maintenance');
  return (
    <main
      id="main"
      className="container-page flex min-h-dvh flex-col items-center justify-center gap-6 text-center"
    >
      <Logo className="flex items-center gap-2" />
      <h1 className="text-4xl font-medium">{t('title')}</h1>
      <p className="max-w-md text-lg text-muted-foreground">{t('text', { brand: brand.name })}</p>
    </main>
  );
}
