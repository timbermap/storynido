import { getTranslations } from 'next-intl/server';

import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('NotFound');
  return (
    <section className="container-page flex min-h-[60vh] flex-col items-center justify-center gap-4 py-20 text-center">
      <p className="font-display text-6xl text-primary">404</p>
      <h1 className="text-3xl font-medium">{t('title')}</h1>
      <p className="max-w-md text-muted-foreground">{t('text')}</p>
      <Link href="/" className={buttonVariants()}>
        {t('home')}
      </Link>
    </section>
  );
}
