import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import {
  MadeToMeasure,
  OCCASION_BADGE,
  OCCASION_ICONS,
  OccasionChips,
  OccasionStoryGrid,
} from '@/components/events/occasions';
import { LandingCollections } from '@/components/landing/sections';
import { RememberChannel } from '@/components/landing/remember-channel';
import { CatalogLineChips } from '@/components/layout/catalog-line-chips';
import {
  OCCASION_KEYS,
  OCCASION_SLUGS,
  occasionCollections,
  occasionFromSlug,
  occasionStories,
} from '@/lib/event-occasions';
import { localizedAlternates } from '@/lib/seo';
import { getCollections, getStories } from '@/lib/server/api';
import { cn } from '@/lib/utils';

interface Props {
  params: Promise<{ locale: string; occasion: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, occasion } = await params;
  const locale = raw as Locale;
  const key = occasionFromSlug(locale, occasion);
  if (!key) return {};
  const t = await getTranslations({ locale, namespace: 'Landing.events' });
  return {
    title: t(`occasions.${key}.title`),
    description: t(`occasions.${key}.meta`),
    alternates: localizedAlternates(locale, (target) => ({
      pathname: '/events/themes/[occasion]',
      params: { occasion: OCCASION_SLUGS[target][key] },
    })),
  };
}

/**
 * Una ocasión de Celebraciones (mesa 25 Nov 2026, DECISIONS 331): sus temáticas con el botón para
 * diseñar el kit, y después todos sus cuentos con el título legible.
 */
export default async function EventsOccasionPage({ params }: Props) {
  const { locale: raw, occasion } = await params;
  const locale = raw as Locale;
  const key = occasionFromSlug(locale, occasion);
  if (!key) notFound();
  const [t, collections, all] = await Promise.all([
    getTranslations('Landing.events'),
    getCollections(locale, 'events').catch(() => []),
    getStories(locale, undefined, { channel: 'events' }).catch(() => []),
  ]);
  const themes = occasionCollections(key, collections);
  const stories = occasionStories(
    themes.map((theme) => theme.slug),
    all,
  );
  const available = OCCASION_KEYS.filter(
    (other) => occasionCollections(other, collections).length > 0,
  );
  const Icon = OCCASION_ICONS[key];
  return (
    <>
      <RememberChannel channel="events" />
      <CatalogLineChips />
      <div className="container-page pt-14">
        <p
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold',
            OCCASION_BADGE,
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          {t(`occasions.${key}.name`)}
        </p>
        <h1 className="mt-4 text-[clamp(2rem,4vw,3rem)] leading-tight font-medium">
          {t(`occasions.${key}.title`)}
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-muted-foreground">
          {t(`occasions.${key}.intro`)}
        </p>
        <MadeToMeasure className="mt-6 max-w-4xl" />
        <OccasionChips locale={locale} current={key} available={available} />
      </div>
      {/* Las temáticas de la ocasión, cada una con su botón para diseñar el kit. */}
      <LandingCollections
        title={themes.length > 1 ? t('occasionPickTheme') : t('occasionKitTitle')}
        collections={themes}
        stories={all}
        createLabel={t('viewStory')}
        line="events"
        start={{ label: t('collectionStart'), mode: 'theme' }}
        followed
      />
      {/* Con varias temáticas, «buscar por cuento»: todos los cuentos de la ocasión juntos. */}
      {themes.length > 1 && stories.length > 0 && (
        <div className="container-page pt-6 pb-20 lg:pb-24">
          <h2 className="text-2xl leading-tight font-medium lg:text-3xl">
            {t('occasionStoriesTitle')}
          </h2>
          <OccasionStoryGrid stories={stories} />
          <p className="mt-10 max-w-3xl text-sm text-muted-foreground">{t('occasionNote')}</p>
        </div>
      )}
      {themes.length <= 1 && (
        <div className="container-page pb-20 lg:pb-24">
          <p className="max-w-3xl text-sm text-muted-foreground">{t('occasionNote')}</p>
        </div>
      )}
    </>
  );
}
