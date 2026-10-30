import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { NewChoice } from '@/components/wizard/new-choice';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const t = await getTranslations({
    locale: (await params).locale,
    namespace: 'Account.myStories',
  });
  return { title: t('newTitle'), robots: { index: false } };
}

/** Selector de línea antes del creador; se saltea si ya se sabe qué quiere crear. */
export default async function NewPage() {
  const t = await getTranslations('Account.myStories');
  return (
    <section className="container-page grid max-w-3xl gap-6 py-14">
      <h1 className="text-3xl font-medium sm:text-4xl">{t('newTitle')}</h1>
      <NewChoice />
    </section>
  );
}
