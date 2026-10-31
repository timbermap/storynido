import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

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
    alternates: localizedAlternates(locale, () => '/stories'),
  };
}

/** Buscador general: todas las líneas, y cada historia dice de cuál es (DECISIONS 150). */
export default async function StoriesPage({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  return <CatalogView locale={locale as Locale} query={query} base="/stories" channel={null} />;
}
