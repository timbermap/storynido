import { ArrowLeft, BookOpen } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import type { Locale } from '@storynido/shared';

import { JsonLd } from '@/components/json-ld';
import { CountryNotice } from '@/components/stories/country-notice';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { brand } from '@/lib/brand';
import { formatPrice } from '@/lib/format';
import { localizedAlternates } from '@/lib/seo';
import { getOffer, getStory } from '@/lib/server/api';
import { getDisplayCountry } from '@/lib/server/request-context';
import { absoluteUrl } from '@/lib/site';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const story = await getStory(locale as Locale, slug);
  if (!story) return {};
  return {
    title: story.title,
    description: story.summary,
    alternates: localizedAlternates(locale as Locale, () => ({
      pathname: '/stories/[slug]',
      params: { slug },
    })),
    openGraph: {
      title: story.title,
      description: story.summary,
      images: [{ url: story.coverImage }],
    },
  };
}

export default async function StoryPage({ params }: Props) {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale as Locale;

  const display = await getDisplayCountry(locale);
  const [story, offer, t, tSwitch] = await Promise.all([
    getStory(locale, slug),
    getOffer(display.country, locale),
    getTranslations('Stories'),
    getTranslations('Switchers'),
  ]);
  if (!story) notFound();

  const countryName = tSwitch(`countries.${display.country}`);
  const price = (amountMinor: number) =>
    offer ? formatPrice(amountMinor, offer.currency, locale, display.country) : '';
  const amounts = offer?.formats.map((f) => f.amountMinor) ?? [];

  return (
    <article className="container-page py-10 sm:py-14">
      {offer?.available && amounts.length > 0 && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: story.title,
            description: story.summary,
            image: absoluteUrl(story.coverImage),
            brand: { '@type': 'Brand', name: brand.name },
            offers: {
              '@type': 'AggregateOffer',
              priceCurrency: offer.currency,
              lowPrice: Math.min(...amounts) / 100,
              highPrice: Math.max(...amounts) / 100,
              offerCount: amounts.length,
              availability: 'https://schema.org/InStock',
            },
          }}
        />
      )}

      <Link
        href="/stories"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('back')}
      </Link>

      <div className="mt-6 grid gap-10 md:grid-cols-[2fr_3fr] md:gap-14">
        <div className="mx-auto w-full max-w-sm overflow-hidden rounded-xl shadow-xl ring-1 ring-black/5">
          <Image
            src={story.coverImage}
            alt={story.title}
            width={600}
            height={800}
            unoptimized
            priority
            className="h-full w-full object-cover"
          />
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-sm font-semibold text-primary">
              {t('agesFor', { min: story.ageMin, max: story.ageMax })} ·{' '}
              {t('pages', { count: story.pageCount })}
            </p>
            <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">{story.title}</h1>
            <p className="mt-4 text-lg text-muted-foreground">{story.summary}</p>
          </div>

          <section aria-labelledby="sample" className="rounded-xl border bg-card p-6 shadow-sm">
            <h2
              id="sample"
              className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase"
            >
              <BookOpen className="size-4" aria-hidden="true" />
              {t('sample')}
            </h2>
            <blockquote className="mt-3 font-display text-xl leading-relaxed">
              {story.excerpt}
            </blockquote>
            <p className="mt-3 text-sm text-muted-foreground">{t('sampleNote')}</p>
          </section>

          <section aria-labelledby="formats">
            <h2 id="formats" className="text-xl font-semibold">
              {t('formats')}
            </h2>
            {offer?.available ? (
              <>
                <div className="mt-3">
                  <CountryNotice display={display} />
                </div>
                <ul className="mt-3 divide-y rounded-xl border bg-card">
                  {offer.formats.map((format) => (
                    <li
                      key={format.format}
                      className="flex items-center justify-between gap-4 px-5 py-3"
                    >
                      <span className="font-medium">{format.name}</span>
                      <span className="font-semibold">{price(format.amountMinor)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-muted-foreground">
                  {t('shippingTo', {
                    country: countryName,
                    price: price(offer.shipping.costMinor),
                    min: offer.shipping.etaDaysMin,
                    max: offer.shipping.etaDaysMax,
                  })}{' '}
                  · {offer.taxIncludedInPrice ? t('taxIncluded') : t('taxExtra')}
                </p>
              </>
            ) : (
              <p className="mt-3 text-muted-foreground">
                {t('notAvailable', { country: countryName })}
              </p>
            )}
          </section>

          <div className="space-y-2">
            <Button size="lg" disabled aria-describedby="coming-soon">
              {t('create')}
            </Button>
            <p id="coming-soon" className="text-sm text-muted-foreground">
              {t('comingSoon')}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
