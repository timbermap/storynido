import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { CountryNotice } from '@/components/stories/country-notice';
import { AutoSubmitSelect } from '@/components/stories/auto-submit-select';
import { StoryCard } from '@/components/stories/story-card';
import { Search, X } from 'lucide-react';

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
  // "Todas las edades" llega como `edad=` vacío: no es la franja de 0 a 3.
  const requested = query.edad ? Number(query.edad) : Number.NaN;
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
  const narrowed =
    Boolean(search) || filter !== undefined || collection !== undefined || theme !== undefined;
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

      {/* Una barra: buscar y la edad; abajo, los temas. Sin filas de chips repetidas. */}
      <form role="search" action="" className="mt-8 flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1 sm:max-w-xl">
          <label htmlFor="story-search" className="sr-only">
            {t('searchLabel')}
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="story-search"
            name="q"
            type="search"
            defaultValue={search}
            maxLength={80}
            placeholder={t('searchPlaceholder')}
            className="h-12 w-full rounded-full border bg-card pr-28 pl-12 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <button
            type="submit"
            className="absolute top-1.5 right-1.5 h-9 rounded-full bg-action px-4 text-sm font-semibold text-action-foreground transition hover:bg-action-hover"
          >
            {t('search')}
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <span className="sr-only sm:not-sr-only">{t('filterLabel')}</span>
          <AutoSubmitSelect
            name="edad"
            defaultValue={filter ? String(filter.min) : ''}
            aria-label={t('filterLabel')}
            data-track="catalog_filter_used"
            data-track-filter="age"
            className="h-12 w-full rounded-full border bg-card px-4 text-base font-medium sm:w-auto"
          >
            <option value="">{t('allAgesOption')}</option>
            {AGE_FILTERS.map((f) => (
              <option key={f.min} value={f.min}>
                {t('ageRange', { min: f.min, max: f.max })}
              </option>
            ))}
          </AutoSubmitSelect>
        </label>
        {collection && <input type="hidden" name="coleccion" value={collection.slug} />}
        {theme && <input type="hidden" name="tema" value={theme.key} />}
      </form>

      <nav
        aria-label={t('themeLabel')}
        className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {STORY_THEMES.map(({ key, icon: Icon }) => {
          const active = theme?.key === key;
          return (
            <Link
              key={key}
              // Tocar el tema elegido lo quita.
              href={withQuery({ tema: active ? undefined : key })}
              data-track="catalog_filter_used"
              data-track-filter="theme"
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition',
                active
                  ? 'border-primary bg-secondary text-primary'
                  : 'bg-card text-foreground/80 hover:border-primary/40',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {t(`themes.${key}`)}
              {active && <X className="size-4" aria-label={t('removeFilter')} />}
            </Link>
          );
        })}
      </nav>

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
          {/* Cuántas quedaron y qué filtros hay, cada uno con su ✕ (se anuncia al cambiar). */}
          <div className="mt-8 flex flex-wrap items-center gap-2 text-sm">
            <p role="status" className="mr-2 font-semibold text-muted-foreground">
              {t('resultCount', { count: visible.length })}
            </p>
            {[
              search ? { label: `“${search}”`, href: withQuery({ q: undefined }) } : null,
              filter
                ? {
                    label: t('ageRange', { min: filter.min, max: filter.max }),
                    href: withQuery({ edad: undefined }),
                  }
                : null,
              collection
                ? { label: collection.name, href: withQuery({ coleccion: undefined }) }
                : null,
            ]
              .filter((item) => item !== null)
              .map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-muted px-3 font-medium hover:bg-secondary"
                >
                  {item.label}
                  <X className="size-3.5" aria-label={t('removeFilter')} />
                </Link>
              ))}
            {narrowed && (
              <Link href="/stories" className="ml-1 font-semibold text-primary hover:underline">
                {t('clearAll')}
              </Link>
            )}
          </div>
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
