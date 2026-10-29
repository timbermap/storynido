import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { CountryNotice } from '@/components/stories/country-notice';
import { StoryCard } from '@/components/stories/story-card';
import { Search } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import { lowestPrice } from '@/lib/offer';
import { localizedAlternates } from '@/lib/seo';
import { getCollections, getOffer, getStories } from '@/lib/server/api';
import { getDisplayCountry } from '@/lib/server/request-context';
import { STORY_THEMES, matchesSearch, matchesTheme } from '@/lib/story-themes';
import { cn } from '@/lib/utils';

const AGE_FILTERS = [
  { min: 0, max: 3 },
  { min: 4, max: 6 },
  { min: 7, max: 9 },
  { min: 10, max: 12 },
] as const;

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ edad?: string; coleccion?: string; tema?: string; q?: string }>;
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
  const theme = STORY_THEMES.find((item) => item.key === query.tema);
  const search = query.q?.trim().slice(0, 80) ?? '';
  /** Hay búsqueda o filtros: se muestra cuántas historias quedaron. */
  const narrowed = Boolean(search) || filter !== undefined || collection !== undefined;
  const visible = stories
    .filter((story) => !filter || (story.ageMin <= filter.max && story.ageMax >= filter.min))
    .filter((story) => !collection || story.collectionIds.includes(collection.slug))
    .filter((story) => !theme || matchesTheme(story, theme.key))
    .filter((story) => !search || matchesSearch(story, search));
  const withQuery = (extra: Record<string, string | undefined>) => {
    const merged = Object.fromEntries(
      Object.entries({
        edad: filter ? String(filter.min) : undefined,
        coleccion: collection?.slug,
        tema: theme?.key,
        q: search || undefined,
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

      <form role="search" action="" className="mt-8 flex max-w-xl gap-2">
        <label htmlFor="story-search" className="sr-only">
          {t('searchLabel')}
        </label>
        <input
          id="story-search"
          name="q"
          type="search"
          defaultValue={search}
          maxLength={80}
          placeholder={t('searchPlaceholder')}
          className="h-11 min-w-0 flex-1 rounded-full border bg-card px-5 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        {filter && <input type="hidden" name="edad" value={filter.min} />}
        {collection && <input type="hidden" name="coleccion" value={collection.slug} />}
        {theme && <input type="hidden" name="tema" value={theme.key} />}
        <button
          type="submit"
          aria-label={t('search')}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-action text-action-foreground transition hover:bg-action-hover"
        >
          <Search className="size-5" aria-hidden="true" />
        </button>
      </form>

      <nav aria-label={t('themeLabel')} className="mt-5 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-semibold">{t('themeLabel')}:</span>
        <FilterLink
          filter="theme"
          href={withQuery({ tema: undefined })}
          active={!theme}
          label={t('allThemes')}
        />
        {STORY_THEMES.map((item) => (
          <FilterLink
            filter="theme"
            key={item.key}
            href={withQuery({ tema: item.key })}
            active={theme?.key === item.key}
            label={t(`themes.${item.key}`)}
          />
        ))}
      </nav>

      <nav aria-label={t('filterLabel')} className="mt-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-semibold">{t('filterLabel')}:</span>
        <FilterLink
          filter="age"
          href={withQuery({ edad: undefined })}
          active={!filter}
          label={t('allAges')}
        />
        {AGE_FILTERS.map((f) => (
          <FilterLink
            filter="age"
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
            filter="collection"
            href={withQuery({ coleccion: undefined })}
            active={!collection}
            label={t('allCollections')}
          />
          {collections.map((item) => (
            <FilterLink
              filter="collection"
              key={item.slug}
              href={withQuery({ coleccion: item.slug })}
              active={collection?.slug === item.slug}
              label={item.name}
            />
          ))}
        </nav>
      )}

      {filter && visible.length > 0 && visible.length < 3 && (
        <p role="note" className="mt-8 max-w-2xl rounded-lg bg-accent px-4 py-3 text-sm">
          {t('fewForAge', { min: filter.min, max: filter.max })}
        </p>
      )}

      {visible.length === 0 ? (
        <div className="mt-12">
          <p className="text-muted-foreground">
            {search ? t('emptySearch', { query: search }) : t('empty')}
          </p>
          <Link href="/stories" className="mt-3 inline-block font-semibold text-primary">
            {t('clearFilters')}
          </Link>
        </div>
      ) : (
        <>
          {/* Con búsqueda o filtros, cuántas quedaron (se anuncia al cambiar). */}
          {narrowed && (
            <p role="status" className="mt-8 text-sm font-semibold text-muted-foreground">
              {t('resultCount', { count: visible.length })}
            </p>
          )}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
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
        </>
      )}
    </div>
  );
}

function FilterLink({
  href,
  active,
  label,
  filter,
}: {
  href: '/stories' | { pathname: '/stories'; query: Record<string, string> };
  active: boolean;
  label: string;
  /** Qué filtro es, para el evento del embudo (sin datos personales). */
  filter: 'age' | 'theme' | 'collection';
}) {
  return (
    <Link
      href={href}
      data-track="catalog_filter_used"
      data-track-filter={filter}
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
