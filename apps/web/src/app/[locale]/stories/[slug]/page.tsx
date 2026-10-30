import { ArrowLeft, BookOpen, Check, Truck } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import {
  KIT_PIECES,
  parseChannel,
  type BookLength,
  type EditorialConfig,
  type Locale,
} from '@storynido/shared';

import { SignedInLabel } from '@/components/auth/signed-in-label';
import { JsonLd } from '@/components/json-ld';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { brand } from '@/lib/brand';
import { formatPrice } from '@/lib/format';
import { localizedAlternates } from '@/lib/seo';
import { getEditorial, getEventPricing, getLessons, getOffer, getStory } from '@/lib/server/api';
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
  const [story, offer, lessons, t, tLessons, tLengths, tFormats, editorial] = await Promise.all([
    getStory(locale, slug),
    getOffer(display.country, locale),
    getLessons(locale).catch(() => []),
    getTranslations('Stories'),
    getTranslations('Lessons'),
    getTranslations('Wizard.book.lengths'),
    getTranslations('Formats'),
    getEditorial(),
  ]);
  if (!story) notFound();
  // Desde Eventos o Profesionales: la ficha vuelve a esa landing y crea en esa línea.
  const line =
    requestedLine && requestedLine !== 'families' && story.channels.includes(requestedLine)
      ? requestedLine
      : null;

  // Celebraciones: la ficha vende el kit (piezas y precio del país), no el libro individual.
  const kitPricing = line === 'events' ? await getEventPricing(display.country) : null;
  const tKit = await getTranslations('Checkout.kit');

  const amounts = offer?.formats.map((f) => f.amountMinor) ?? [];
  // Comparador: cada extensión que admite la historia, con sus páginas y en qué formatos sale.
  const offered = new Set(offer?.formats.map((f) => f.format) ?? []);
  // Cada extensión: el ebook (PDF) y, si se imprime, el libro físico con sus tapas.
  const lengthOptions = story.lengths
    .filter((length) => editorial.lengths[length].active)
    .map((length) => {
      const formats = editorial.lengths[length].formats.filter((format) => offered.has(format));
      const covers = formats
        .filter((format) => format !== 'digital')
        .map((format) => tFormats(format));
      return {
        length,
        pages: editorial.lengths[length].interiorPages,
        formats: [
          ...(formats.includes('digital') ? [t('formatEbook')] : []),
          ...(covers.length > 0 ? [t('formatPrinted', { covers: covers.join(' · ') })] : []),
        ],
      };
    });

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
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
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
                <ul className="mt-3 flex flex-wrap gap-3">
                  {(story.suggestedLessons?.length
                    ? story.suggestedLessons.flatMap((slug) =>
                        lessons.filter((lesson) => lesson.slug === slug),
                      )
                    : lessons.filter(
                        (lesson) => lesson.ageMin <= story.ageMax && lesson.ageMax >= story.ageMin,
                      )
                  )
                    .slice(0, 6)
                    .map((lesson) => (
                      <li key={lesson.slug}>
                        <Link
                          href={{ pathname: '/lessons/[slug]', params: { slug: lesson.slug } }}
                          className="inline-flex min-h-9 items-center rounded-full bg-secondary px-4 py-1.5 text-sm font-bold text-primary hover:underline"
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
              <ul className="mt-3 divide-y rounded-xl border bg-card">
                {lengthOptions.map((option) => (
                  <li
                    key={option.length}
                    className="grid gap-x-6 gap-y-2 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div>
                      <p className="flex flex-wrap items-baseline gap-x-3">
                        <span className="font-semibold">{tLengths(`${option.length}.name`)}</span>
                        <span className="text-sm text-muted-foreground">
                          {t('pages', { count: option.pages })}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {tLengths(`${option.length}.text`)}
                      </p>
                    </div>
                    {option.formats.length > 0 && (
                      <ul
                        aria-label={t('lengthFormats')}
                        className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground/80 sm:flex-col sm:items-start sm:gap-y-0.5"
                      >
                        {option.formats.map((name) => (
                          <li key={name} className="inline-flex items-center gap-1.5">
                            <Check className="size-4 text-success" aria-hidden="true" />
                            {name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* El precio y el país de envío se ven en el creador y el pago; acá solo se avisa del envío. */}
          {line !== 'events' && offer?.formats.some((format) => format.estimated) && (
            <p className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <Truck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              {t('shippingCalculated')}
            </p>
          )}

          {line === 'events' && (
            <section aria-labelledby="kit">
              <h2 id="kit" className="text-xl font-medium">
                {t('kitTitle')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('kitText')}</p>
              <ul className="mt-3 divide-y rounded-xl border bg-card">
                {KIT_PIECES.filter(
                  (piece) => piece === 'mini_book' || !kitPricing || piece in kitPricing.pieces,
                ).map((piece) => {
                  const minor =
                    piece === 'mini_book' ? kitPricing?.designMinor : kitPricing?.pieces[piece];
                  return (
                    <li key={piece} className="flex items-center justify-between gap-4 px-5 py-3">
                      <span>
                        <span className="block font-medium">{tKit(`pieces.${piece}.name`)}</span>
                        <span className="block text-sm text-muted-foreground">
                          {tKit(`pieces.${piece}.text`)}
                        </span>
                      </span>
                      {kitPricing && minor !== undefined && (
                        <span className="shrink-0 font-semibold">
                          {piece === 'mini_book' ? '' : '+ '}
                          {formatPrice(minor, kitPricing.currency, locale, display.country)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <Link
            href={{
              pathname: '/create',
              query: line ? { story: story.slug, line } : { story: story.slug },
            }}
            className={buttonVariants({ size: 'lg' })}
          >
            {line === 'events' ? (
              <SignedInLabel guest={t('createKitGuest')} member={t('createKit')} />
            ) : (
              <SignedInLabel guest={t('createGuest')} member={t('create')} />
            )}
          </Link>
        </div>
      </div>
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
