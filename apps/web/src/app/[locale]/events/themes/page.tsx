import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { LandingCollections } from '@/components/landing/sections';
import { RememberChannel } from '@/components/landing/remember-channel';
import { CatalogLineChips } from '@/components/layout/catalog-line-chips';
import { localizedAlternates } from '@/lib/seo';
import { getCollections, getStories } from '@/lib/server/api';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: 'Landing.events' });
  return {
    title: t('catalogTitle'),
    description: t('metaDescription'),
    alternates: localizedAlternates(locale, () => '/events/themes'),
  };
}

/** Catálogo de events (estudio de catálogo, DECISIONS 150): las temáticas de fiesta, cada una con su kit. */
export default async function EventsCatalogPage({ params }: Props) {
  const locale = (await params).locale as Locale;
  const [t, collections, stories] = await Promise.all([
    getTranslations('Landing.events'),
    getCollections(locale, 'events').catch(() => []),
    getStories(locale, undefined, { channel: 'events' }).catch(() => []),
  ]);
  const isOccasion = (item: (typeof collections)[number]) =>
    Boolean(item.eventType && item.eventType !== 'birthday');
  const birthdays = collections.filter((item) => !isOccasion(item));
  const occasions = collections.filter(isOccasion);
  return (
    <>
      <RememberChannel channel="events" />
      <CatalogLineChips />
      <div className="container-page pt-14">
        <h1 className="text-[clamp(2rem,4vw,3rem)] leading-tight font-medium">
          {t('catalogTitle')}
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{t('catalogSubtitle')}</p>
      </div>
      <LandingCollections
        collections={birthdays}
        followed={occasions.length > 0}
        stories={stories}
        createLabel={t('viewStory')}
        line="events"
        start={{ label: t('collectionStart'), mode: 'theme' }}
      />
      {/* Las ocasiones que no son cumpleaños (primera comunión, graduación), con su subtítulo. */}
      <LandingCollections
        title={t('otherCelebrations')}
        continued
        collections={occasions}
        stories={stories}
        createLabel={t('viewStory')}
        line="events"
        start={{ label: t('collectionStart'), mode: 'theme' }}
      />
    </>
  );
}
