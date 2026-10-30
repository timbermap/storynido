import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { KIT_PIECES, type Locale } from '@storynido/shared';

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
import { PhotoPromise } from '@/components/landing/photo-promise';
import { Link } from '@/i18n/navigation';
import { brand } from '@/lib/brand';
import { localizedAlternates } from '@/lib/seo';
import { formatPrice } from '@/lib/format';
import { getCollections, getEventPricing, getStories } from '@/lib/server/api';
import { getDisplayCountry } from '@/lib/server/request-context';
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

/** StoryNido Celebraciones (ruta /events): kits de cumpleaños, un diseño y muchas copias. */
export default async function EventsPage({ params }: Props) {
  const locale = (await params).locale as Locale;
  const display = await getDisplayCountry(locale);
  const [t, tKit, collections, stories, pricing] = await Promise.all([
    getTranslations('Landing.events'),
    getTranslations('Checkout.kit'),
    getCollections(locale, 'events').catch(() => []),
    getStories(locale, undefined, { channel: 'events' }).catch(() => []),
    getEventPricing(display.country),
  ]);
  // Las piezas reales del kit, con el precio del país (el mismo que cobra el checkout).
  const money = (minor: number) =>
    pricing ? formatPrice(minor, pricing.currency, locale, display.country) : '';
  const pieces = KIT_PIECES.filter(
    (piece) => piece === 'mini_book' || (pricing ? piece in pricing.pieces : true),
  );
  const pieceLabel = (piece: (typeof KIT_PIECES)[number]) => {
    if (!pricing) return t('kitTagNow');
    if (piece === 'mini_book') return t('kitDesign', { price: money(pricing.designMinor) });
    return t('kitExtra', { price: money(pricing.pieces[piece] ?? 0) });
  };
  const fullKit = pricing
    ? pricing.designMinor +
      pieces.reduce(
        (sum, piece) => sum + (piece === 'mini_book' ? 0 : (pricing.pieces[piece] ?? 0)),
        0,
      )
    : null;
  const cta = (
    <Link href={{ pathname: '/create', query: { line: 'events' } }} className={ctaClass}>
      {t('cta')}
    </Link>
  );
  const keys = ['1', '2', '3', '4'] as const;

  return (
    <>
      <RememberChannel channel="events" />
      <LandingHero
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        cta={cta}
        note={t('note')}
        priceLine={
          fullKit !== null ? `${t('kitFull', { price: money(fullKit) })} ${t('kitUsd')}` : undefined
        }
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
        items={[
          ...pieces.map((piece) => ({
            title: tKit(`pieces.${piece}.name`),
            text: tKit(`pieces.${piece}.text`),
            tag: { label: pieceLabel(piece), available: true },
          })),
          { title: t('kit.7'), tag: { label: t('kitTagQuote'), available: false } },
        ]}
        note={
          fullKit !== null
            ? `${t('kitFull', { price: money(fullKit) })} ${t('kitUsd')} ${t('kitNote')}`
            : t('kitNote')
        }
      />
      <LandingCollections
        title={t('collectionsTitle')}
        collections={collections}
        stories={stories}
        createLabel={t('viewStory')}
        line="events"
        start={{ label: t('collectionStart'), mode: 'theme' }}
      />
      <PhotoPromise />

      <LandingFaq
        title={t('faqTitle')}
        items={keys.map((key) => ({ question: t(`faq.${key}.q`), answer: t(`faq.${key}.a`) }))}
      />
      <LandingFinalCta title={t('finalTitle')} cta={cta} />
      {/* Datos para buscadores (schema.org), después del contenido visible. */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: t('metaTitle'),
          description: t('metaDescription'),
          provider: { '@type': 'Organization', name: brand.name, url: absoluteUrl('/') },
        }}
      />
    </>
  );
}
