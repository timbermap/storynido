import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { CountryNotice } from '@/components/stories/country-notice';
import { StoryCard } from '@/components/stories/story-card';
import { Link } from '@/i18n/navigation';
import { lowestPrice } from '@/lib/offer';
import { localizedAlternates } from '@/lib/seo';
import { getCollections, getOffer, getStories } from '@/lib/server/api';
import { getDisplayCountry } from '@/lib/server/request-context';
import { cn } from '@/lib/utils';

const AGE_FILTERS = [
  { min: 0, max: 3 },
  { min: 4, max: 6 },
  { min: 7, max: 9 },
  { min: 10, max: 12 },
] as const;

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ edad?: string; coleccion?: string }>;
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

export default async function StoriesPage({ params, searchParams }: Props) {
  const locale = (await params).locale as Locale;
  const t = await getTranslations('Stories');

  const query = await searchParams;
  const requested = Number(query.edad);
  const filter = AGE_FILTERS.find((f) => f.min === requested);
  const display = await getDisplayCountry(locale);

  // Se filtra por el rango completo: una historia aplica si se superpone con el rango elegido.
  // El catálogo es la tienda de Familias, con sus colecciones.
  const [stories, offer, allCollections] = await Promise.all([
    getStories(locale, undefined, { channel: 'families' }),
    getOffer(display.country, locale),
    getCollections(locale, 'families').catch(() => []),
  ]);
  // Solo las colecciones con alguna historia disponible.
  const collections = allCollections.filter((item) =>
    stories.some((story) => story.collectionIds.includes(item.slug)),
  );
  const collection = collections.find((item) => item.slug === query.coleccion);
  const visible = stories
    .filter((story) => !filter || (story.ageMin <= filter.max && story.ageMax >= filter.min))
    .filter((story) => !collection || story.collectionIds.includes(collection.slug));
  const withQuery = (extra: Record<string, string | undefined>) => {
    const merged = Object.fromEntries(
      Object.entries({
        edad: filter ? String(filter.min) : undefined,
        coleccion: collection?.slug,
        ...extra,
      }).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );
    return Object.keys(merged).length > 0
      ? { pathname: '/stories' as const, query: merged }
      : ('/stories' as const);
  };
  const fromPrice = lowestPrice(offer, locale, display.country);

  return (
    <div className="container-page py-14">
      <header className="max-w-2xl">
        <h1 className="text-4xl font-medium sm:text-5xl">{t('title')}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t('subtitle')}</p>
        <div className="mt-4">
          <CountryNotice display={display} />
        </div>
      </header>

      <nav aria-label={t('filterLabel')} className="mt-8 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-semibold">{t('filterLabel')}:</span>
        <FilterLink href={withQuery({ edad: undefined })} active={!filter} label={t('allAges')} />
        {AGE_FILTERS.map((f) => (
          <FilterLink
            key={f.min}
            href={withQuery({ edad: String(f.min) })}
            active={filter?.min === f.min}
            label={t('ageRange', { min: f.min, max: f.max })}
          />
        ))}
      </nav>

      {collections.length > 1 && (
        <nav aria-label={t('collectionLabel')} className="mt-3 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-semibold">{t('collectionLabel')}:</span>
          <FilterLink
            href={withQuery({ coleccion: undefined })}
            active={!collection}
            label={t('allCollections')}
          />
          {collections.map((item) => (
            <FilterLink
              key={item.slug}
              href={withQuery({ coleccion: item.slug })}
              active={collection?.slug === item.slug}
              label={item.name}
            />
          ))}
        </nav>
      )}

      {visible.length === 0 ? (
        <p className="mt-12 text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
          {visible.map((story, index) => (
            <StoryCard
              key={story.slug}
              story={story}
              fromPrice={fromPrice}
              headingLevel="h2"
              priority={index < 2}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterLink({
  href,
  active,
  label,
}: {
  href: '/stories' | { pathname: '/stories'; query: Record<string, string> };
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-full border px-4 py-1.5 text-sm font-medium transition',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
      )}
    >
      {label}
    </Link>
  );
}
