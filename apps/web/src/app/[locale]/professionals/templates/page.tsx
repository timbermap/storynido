import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { LandingCollections } from '@/components/landing/sections';
import { RememberChannel } from '@/components/landing/remember-channel';
import { localizedAlternates } from '@/lib/seo';
import { getCollections, getStories } from '@/lib/server/api';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: 'Landing.professionals' });
  return {
    title: t('catalogTitle'),
    description: t('metaDescription'),
    alternates: localizedAlternates(locale, () => '/professionals/templates'),
  };
}

/** Catálogo de professionals (estudio de catálogo, DECISIONS 150): las plantillas por objetivo. */
export default async function ProfessionalsCatalogPage({ params }: Props) {
  const locale = (await params).locale as Locale;
  const [t, collections, stories] = await Promise.all([
    getTranslations('Landing.professionals'),
    getCollections(locale, 'professionals').catch(() => []),
    getStories(locale, undefined, { channel: 'professionals' }).catch(() => []),
  ]);
  return (
    <>
      <RememberChannel channel="professionals" />
      <div className="container-page pt-14">
        <h1 className="text-[clamp(2rem,4vw,3rem)] leading-tight font-medium">
          {t('catalogTitle')}
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{t('catalogSubtitle')}</p>
      </div>
      <LandingCollections
        title={t('collectionsTitle')}
        subtitle={t('collectionsSubtitle')}
        collections={collections}
        stories={stories}
        createLabel={t('viewStory')}
        line="professionals"
        start={{ label: t('collectionStart'), mode: 'story' }}
      />
    </>
  );
}
