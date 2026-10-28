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

/** Modo "solo vista previa": se puede crear la muestra, pero las compras están pausadas. */
export async function PreviewOnlyBanner() {
  const t = await getTranslations('Maintenance');
  return (
    <p
      role="status"
      className="bg-secondary px-4 py-2 text-center text-sm font-semibold text-secondary-foreground"
    >
      {t('previewOnly')}
    </p>
  );
}
