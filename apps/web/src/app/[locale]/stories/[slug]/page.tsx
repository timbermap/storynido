import { ArrowLeft, BookOpen, Check } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import {
  parseChannel,
  type BookLength,
  type EditorialConfig,
  type Locale,
} from '@storynido/shared';

import { JsonLd } from '@/components/json-ld';
import { CountryNotice } from '@/components/stories/country-notice';
import { ShipToSelect } from '@/components/stories/ship-to-select';
import { StoryExample } from '@/components/stories/story-example';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { brand } from '@/lib/brand';
import { countryName } from '@/lib/country-names';
import { formatPrice } from '@/lib/format';
import { localizedAlternates } from '@/lib/seo';
import { getEditorial, getLessons, getOffer, getStory } from '@/lib/server/api';
import { getDisplayCountry } from '@/lib/server/request-context';
import { absoluteUrl } from '@/lib/site';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
  searchParams?: Promise<{ line?: string }>;
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

export default async function StoryPage({ params, searchParams }: Props) {
  const { locale: rawLocale, slug } = await params;
  const requestedLine = parseChannel((await searchParams)?.line);
  const locale = rawLocale as Locale;

  const display = await getDisplayCountry(locale);
  const [story, offer, lessons, t, tLessons, tLengths, editorial] = await Promise.all([
    getStory(locale, slug),
    getOffer(display.country, locale),
    getLessons(locale).catch(() => []),
    getTranslations('Stories'),
    getTranslations('Lessons'),
    getTranslations('Wizard.book.lengths'),
    getEditorial(),
  ]);
  if (!story) notFound();
  // Desde Eventos o Profesionales: la ficha vuelve a esa landing y crea en esa línea.
  const line =
    requestedLine && requestedLine !== 'families' && story.channels.includes(requestedLine)
      ? requestedLine
      : null;

  const countryLabel = countryName(display.country, locale);
  const price = (amountMinor: number) =>
    offer ? formatPrice(amountMinor, offer.currency, locale, display.country) : '';
  const amounts = offer?.formats.map((f) => f.amountMinor) ?? [];
  // Comparador: cada extensión que admite la historia, con sus páginas y en qué formatos sale.
  const formatNames = new Map(offer?.formats.map((f) => [f.format, f.name]) ?? []);
  const lengthOptions = story.lengths
    .filter((length) => editorial.lengths[length].active)
    .map((length) => ({
      length,
      pages: editorial.lengths[length].interiorPages,
      formats: editorial.lengths[length].formats
        .map((format) => formatNames.get(format))
        .filter((name): name is string => Boolean(name)),
    }));

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
        href={
          line === 'events' ? '/events' : line === 'professionals' ? '/professionals' : '/stories'
        }
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {line ? t(`backTo.${line}`) : t('back')}
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
              {pagesLabel(t, story.lengths, editorial)}
            </p>
            <h1 className="mt-2 text-4xl font-medium sm:text-5xl">{story.title}</h1>
            <p className="mt-4 text-lg text-muted-foreground">{story.summary}</p>
          </div>

          <section aria-labelledby="sample" className="rounded-xl border bg-card p-6 shadow-sm">
            <h2
              id="sample"
              className="flex items-center gap-2 text-sm font-medium tracking-wide text-muted-foreground uppercase"
            >
              <BookOpen className="size-4" aria-hidden="true" />
              {t('sample')}
            </h2>
            <blockquote className="mt-3 font-display text-xl leading-relaxed">
              {story.excerpt}
            </blockquote>
            <p className="mt-3 text-sm text-muted-foreground">{t('sampleNote')}</p>
          </section>

          {/* Historia con propósito propio (Profesionales): sus objetivos, no enseñanzas generales. */}
          {story.objectives?.length ? (
            <section aria-labelledby="objectives">
              <h2 id="objectives" className="text-xl font-medium">
                {t('objectivesTitle')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('objectivesText')}</p>
              <ul className="mt-3 grid gap-2">
                {story.objectives.map((objective) => (
                  <li key={objective} className="flex items-start gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-success" aria-hidden="true" />
                    {objective}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            lessons.length > 0 && (
              <section aria-labelledby="lessons">
                <h2 id="lessons" className="text-xl font-medium">
                  {tLessons('storyCombine')}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{tLessons('storyCombineText')}</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {lessons
                    .filter(
                      (lesson) => lesson.ageMin <= story.ageMax && lesson.ageMax >= story.ageMin,
                    )
                    .slice(0, 6)
                    .map((lesson) => (
                      <li key={lesson.slug}>
                        <Link
                          href={{ pathname: '/lessons/[slug]', params: { slug: lesson.slug } }}
                          className="inline-block rounded-full bg-secondary px-3.5 py-1.5 text-sm font-bold text-primary hover:underline"
                        >
                          {lesson.name}
                        </Link>
                      </li>
                    ))}
                </ul>
              </section>
            )
          )}

          {line !== 'events' && lengthOptions.length > 1 && (
            <section aria-labelledby="lengths">
              <h2 id="lengths" className="text-xl font-medium">
                {t('lengthsTitle')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('lengthsText')}</p>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {lengthOptions.map((option) => (
                  <li key={option.length} className="rounded-xl border bg-card px-4 py-3">
                    <p className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold">{tLengths(`${option.length}.name`)}</span>
                      <span className="text-sm text-muted-foreground">
                        {t('pages', { count: option.pages })}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tLengths(`${option.length}.text`)}
                    </p>
                    {option.formats.length > 0 && (
                      <p className="mt-2 text-xs font-semibold text-primary">
                        {option.formats.join(' · ')}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* El kit de Eventos tiene su propio precio (se ve en el creador), no el de los libros. */}
          {line !== 'events' && (
            <section aria-labelledby="formats">
              <h2 id="formats" className="text-xl font-medium">
                {t('formats')}
              </h2>
              <ShipToSelect country={display.country} />
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
                        <span className="font-semibold">
                          {format.estimated
                            ? t('from', { price: price(format.amountMinor) })
                            : price(format.amountMinor)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {offer.formats.some((format) => format.estimated) &&
                      `${
                        offer.shipping.quoted
                          ? t('shippingQuoted', {
                              country: countryLabel,
                              min: offer.shipping.etaDaysMin,
                              max: offer.shipping.etaDaysMax,
                            })
                          : t('shippingTo', {
                              country: countryLabel,
                              price: price(offer.shipping.costMinor),
                              min: offer.shipping.etaDaysMin,
                              max: offer.shipping.etaDaysMax,
                            })
                      } · `}
                    {offer.taxIncludedInPrice ? t('taxIncluded') : t('taxExtra')}
                  </p>
                  {offer.local && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('usdNote', {
                        rate: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
                          offer.local.rate,
                        ),
                        currency: offer.local.currency,
                      })}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-3 text-muted-foreground">
                  {t('notAvailable', { country: countryLabel })}
                </p>
              )}
            </section>
          )}

          <Link
            href={{
              pathname: '/create',
              query: line ? { story: story.slug, line } : { story: story.slug },
            }}
            className={buttonVariants({ size: 'lg' })}
          >
            {t('create')}
          </Link>
        </div>
      </div>

      <section aria-labelledby="browse" className="mt-16">
        <h2 id="browse" className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-medium">
          {t('browse')}
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t('exampleNote')}</p>
        <div className="mt-6 max-w-4xl">
          <StoryExample
            title={story.title}
            coverImage={story.coverImage}
            excerpt={story.excerpt}
            samplePages={story.samplePages}
          />
        </div>
      </section>
    </article>
  );
}

/** Páginas según las extensiones que admite la historia (la cantidad la elige el cliente). */
function pagesLabel(
  t: (key: 'pages' | 'pagesRange', values: Record<string, number>) => string,
  lengths: readonly BookLength[],
  editorial: EditorialConfig,
): string {
  const pages = lengths
    .filter((length) => editorial.lengths[length].active)
    .map((length) => editorial.lengths[length].interiorPages);
  if (pages.length === 0) return '';
  const min = Math.min(...pages);
  const max = Math.max(...pages);
  return min === max ? t('pages', { count: min }) : t('pagesRange', { min, max });
}
