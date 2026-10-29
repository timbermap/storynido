import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { JsonLd } from '@/components/json-ld';
import { RememberChannel } from '@/components/landing/remember-channel';
import {
  LandingChecklist,
  LandingCollections,
  LandingFaq,
  LandingFinalCta,
  LandingHero,
  LandingSteps,
  ctaClass,
} from '@/components/landing/sections';
import { Link } from '@/i18n/navigation';
import { brand } from '@/lib/brand';
import { localizedAlternates } from '@/lib/seo';
import { getCollections, getStories } from '@/lib/server/api';
import { absoluteUrl } from '@/lib/site';

import eventsArt from '../../../../public/brand/landing-eventos.webp';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: 'Landing.events' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: localizedAlternates(locale, () => '/events'),
  };
}

/** StoryNido Eventos: kits de cumpleaños (un diseño, muchas copias). Se crea sin cuenta. */
export default async function EventsPage({ params }: Props) {
  const locale = (await params).locale as Locale;
  const [t, collections, stories] = await Promise.all([
    getTranslations('Landing.events'),
    getCollections(locale, 'events').catch(() => []),
    getStories(locale, undefined, { channel: 'events' }).catch(() => []),
  ]);
  const cta = (
    <Link href={{ pathname: '/create', query: { line: 'events' } }} className={ctaClass}>
      {t('cta')}
    </Link>
  );
  const keys = ['1', '2', '3', '4'] as const;

  return (
    <>
      <RememberChannel channel="events" />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: t('metaTitle'),
          description: t('metaDescription'),
          provider: { '@type': 'Organization', name: brand.name, url: absoluteUrl('/') },
        }}
      />
      <LandingHero
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        cta={cta}
        note={t('note')}
        image={eventsArt}
        imageAlt={t('imageAlt')}
        photoLabel={t('photoLabel')}
      />
      <LandingSteps
        title={t('howTitle')}
        steps={(['1', '2', '3'] as const).map((key) => ({
          title: t(`steps.${key}.title`),
          text: t(`steps.${key}.text`),
        }))}
      />
      <LandingChecklist
        title={t('kitTitle')}
        subtitle={t('kitSubtitle')}
        items={(['1', '2', '3', '4', '5', '6', '7'] as const).map((key) => ({
          title: t(`kit.${key}`),
          tag:
            key === '7'
              ? { label: t('kitTagQuote'), available: false }
              : { label: t('kitTagNow'), available: true },
        }))}
        note={t('kitNote')}
      />
      <LandingCollections
        title={t('collectionsTitle')}
        collections={collections}
        stories={stories}
        createLabel={t('viewStory')}
      />
      <LandingFaq
        title={t('faqTitle')}
        items={keys.map((key) => ({ question: t(`faq.${key}.q`), answer: t(`faq.${key}.a`) }))}
      />
      <LandingFinalCta title={t('finalTitle')} cta={cta} />
    </>
  );
}
