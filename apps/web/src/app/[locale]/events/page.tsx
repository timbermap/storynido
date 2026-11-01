import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import type { KIT_PIECES, Locale } from '@storynido/shared';

import { JsonLd } from '@/components/json-ld';
import { RememberChannel } from '@/components/landing/remember-channel';
import {
  LandingCollections,
  LandingFaq,
  LandingFinalCta,
  LandingHero,
  LandingSteps,
  ctaClass,
} from '@/components/landing/sections';
import { PhotoPromise } from '@/components/landing/photo-promise';
import { PartyDemo } from '@/components/events/party-demo';
import { brand } from '@/lib/brand';
import { localizedAlternates } from '@/lib/seo';
import { formatPrice } from '@/lib/format';
import { Link } from '@/i18n/navigation';
import { lowestPrice } from '@/lib/offer';
import { getCollections, getEventPricing, getOffer, getStories } from '@/lib/server/api';
import { getDisplayCountry } from '@/lib/server/request-context';
import { absoluteUrl } from '@/lib/site';

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

/** StoryNido Celebraciones (ruta /events): la fiesta resuelta, con un mismo protagonista. */
export default async function EventsPage({ params }: Props) {
  const locale = (await params).locale as Locale;
  const display = await getDisplayCountry(locale);
  const [t, collections, stories, pricing, offer] = await Promise.all([
    getTranslations('Landing.events'),
    getCollections(locale, 'events').catch(() => []),
    getStories(locale, undefined, { channel: 'events' }).catch(() => []),
    getEventPricing(display.country),
    getOffer(display.country, locale),
  ]);
  // Precios reales del país (los mismos que cobra el checkout), calculados con la misma regla.
  const money = (minor: number) =>
    pricing ? formatPrice(minor, pricing.currency, locale, display.country) : '';
  const pieceMinor = (piece: (typeof KIT_PIECES)[number]) => pricing?.pieces[piece] ?? 0;
  const offered = pricing ? Object.keys(pricing.pieces) : [];
  const kitMinor = offered
    .filter((piece) => piece !== 'invitation')
    .reduce((sum, piece) => sum + (pricing?.pieces[piece as (typeof KIT_PIECES)[number]] ?? 0), 0);
  const fullMinor = pricing
    ? pricing.designMinor +
      offered.reduce(
        (sum, piece) => sum + (pricing.pieces[piece as (typeof KIT_PIECES)[number]] ?? 0),
        0,
      )
    : 0;
  const percent = pricing?.bundlePercent ?? 0;
  const partyMinor = fullMinor - Math.round((fullMinor * percent) / 100);
  const bookFrom = lowestPrice(offer, locale, display.country);

  const cta = (
    <Link
      href={{ pathname: '/create', query: { line: 'events' } }}
      data-track="events_cta"
      className={ctaClass}
    >
      {t('cta')}
    </Link>
  );
  const keys = ['1', '2', '3', '4', '5'] as const;
  const demoKeys = [
    'youAreInvited',
    'birthday',
    'sample',
    'nameLabel',
    'namePlaceholder',
    'themeLabel',
    'cta',
    'previewAlt',
  ] as const;
  const products = [
    {
      key: '1',
      price: pricing ? t('priceFrom', { price: money(pieceMinor('invitation')) }) : null,
    },
    {
      key: '2',
      price: pricing && kitMinor > 0 ? t('priceFrom', { price: money(kitMinor) }) : null,
    },
    { key: '3', price: pricing ? t('priceIncluded', { price: money(pricing.designMinor) }) : null },
    { key: '4', price: bookFrom ? t('priceFrom', { price: bookFrom }) : null },
  ] as const;

  return (
    <>
      <RememberChannel channel="events" />
      <LandingHero
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        cta={cta}
        note={t('note')}
        media={
          <PartyDemo
            themes={collections.map((item) => ({
              slug: item.slug,
              name: item.name,
              // La ilustración de la invitación de muestra: la portada de la primera historia del tema.
              image: stories.find((story) => story.collectionIds.includes(item.slug))?.coverImage,
            }))}
            labels={Object.fromEntries(demoKeys.map((key) => [key, t(`demo.${key}`)])) as never}
          />
        }
      />
      <section className="bg-muted py-20 lg:py-24">
        <div className="container-page">
          <div className="max-w-2xl">
            <h2 className="text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium">
              {t('productsTitle')}
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">{t('productsSubtitle')}</p>
          </div>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product, index) => (
              <li
                key={product.key}
                className="flex flex-col rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]"
              >
                <span className="text-xs font-bold tracking-[0.11em] text-primary uppercase">
                  {t(`products.${product.key}.question`)}
                </span>
                <h3 className="mt-2 text-xl leading-tight font-medium">
                  {t(`products.${product.key}.name`)}
                </h3>
                <p className="mt-2 flex-1 text-muted-foreground">
                  {t(`products.${product.key}.text`)}
                </p>
                {product.price && <p className="mt-4 font-bold">{product.price}</p>}
                <span className="sr-only">{index + 1}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <LandingSteps
        title={t('howTitle')}
        steps={(['1', '2', '3'] as const).map((key) => ({
          title: t(`steps.${key}.title`),
          text: t(`steps.${key}.text`),
        }))}
      />
      {pricing && (
        <section className="container-page py-20 lg:py-24">
          <div className="max-w-2xl">
            <h2 className="text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium">
              {t('packagesTitle')}
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">{t('packagesSubtitle')}</p>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                {
                  key: 'invitation',
                  price: money(pieceMinor('invitation') + pricing.designMinor),
                  featured: false,
                },
                { key: 'party', price: money(partyMinor), featured: true },
                { key: 'printed', price: null, featured: false },
                {
                  key: 'book',
                  price: bookFrom ? t('priceFrom', { price: bookFrom }) : null,
                  featured: false,
                },
              ] as const
            ).map((item) => (
              <li
                key={item.key}
                className={`flex flex-col rounded-xl border p-5 shadow-[var(--shadow-card)] ${
                  item.featured ? 'border-primary bg-card ring-2 ring-primary/30' : 'bg-card'
                } ${item.key === 'printed' ? 'border-dashed' : ''}`}
              >
                {(item.featured || item.key === 'printed') && (
                  <span className="mb-2 w-fit rounded-full bg-peach px-3 py-0.5 text-xs font-bold text-[#a33f33]">
                    {t(`packages.${item.key}.badge`)}
                  </span>
                )}
                <h3 className="text-xl leading-tight font-medium">
                  {t(`packages.${item.key}.name`)}
                </h3>
                {item.price && <p className="mt-2 text-2xl font-bold">{item.price}</p>}
                {item.key === 'party' && percent > 0 && (
                  <p className="mt-1 text-sm font-bold text-success">
                    {t('packages.party.saving', { percent, price: money(fullMinor) })}
                  </p>
                )}
                <p className="mt-3 text-muted-foreground">{t(`packages.${item.key}.text`)}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm font-bold text-muted-foreground">{t('packagesNote')}</p>
        </section>
      )}
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
