import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { RememberChannel } from '@/components/landing/remember-channel';
import { CatalogView } from '@/components/stories/catalog-view';
import { localizedAlternates } from '@/lib/seo';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ edad?: string; coleccion?: string; tema?: string; q?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: 'Stories' });
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: localizedAlternates(locale, () => '/families/stories'),
  };
}

/** Catálogo de Familias: las historias de regalo por etapa de lectura y ocasión (DECISIONS 150). */
export default async function FamiliesStoriesPage({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  return (
    <>
      <RememberChannel channel="families" />
      <CatalogView
        locale={locale as Locale}
        query={query}
        base="/families/stories"
        channel="families"
      />
    </>
  );
}
