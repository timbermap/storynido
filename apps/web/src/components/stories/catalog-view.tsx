import { getTranslations } from 'next-intl/server';

import { AGE_STAGES, stageOf, type Channel, type Locale } from '@storynido/shared';

import { CountryNotice } from '@/components/stories/country-notice';
import { StoryCard } from '@/components/stories/story-card';
import { LayoutGrid, Search, X } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import { lowestPrice } from '@/lib/offer';
import { getCollections, getOffer, getStories } from '@/lib/server/api';
import { getDisplayCountry } from '@/lib/server/request-context';
import { STORY_THEMES, matchesSearch, matchesTheme } from '@/lib/story-themes';
import { cn } from '@/lib/utils';

// Cuatro etapas de lectura (DECISIONS 149): cada historia pertenece a una.
const AGE_FILTERS = AGE_STAGES;

export type CatalogBase = '/stories' | '/families/stories';

interface CatalogProps {
  locale: Locale;
  query: { edad?: string; coleccion?: string; tema?: string; q?: string };
  /** Ruta del catálogo (los filtros se arman sobre ella). */
  base: CatalogBase;
  /** Una línea: su vidriera. Sin línea: el buscador general, que muestra todas y dice de cuál es cada historia. */
  channel: Channel | null;
}

export async function CatalogView({ locale, query, base, channel }: CatalogProps) {
  const t = await getTranslations('Stories');
  const tLines = await getTranslations('Nav.lines');
  // "Todas las edades" llega como `edad=` vacío: no es la franja de 0 a 3.
  const requested = query.edad ? Number(query.edad) : Number.NaN;
  const filter = AGE_FILTERS.find((f) => f.min === requested);
  const display = await getDisplayCountry(locale);

  // Se filtra por el rango completo: una historia aplica si se superpone con el rango elegido.
  // El catálogo es la tienda de Familias, con sus colecciones.
  const [stories, offer, allCollections] = await Promise.all([
    getStories(locale, undefined, channel ? { channel } : {}),
    getOffer(display.country, locale),
    getCollections(locale, channel ?? 'families').catch(() => []),
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
  // Cada faceta cuenta lo que quedaría al elegirla, con los demás filtros puestos.
  const overlaps = (
    story: { ageMin: number; ageMax: number },
    range: { min: number; max: number },
  ) => stageOf(story) === AGE_STAGES.find((stage) => stage.min === range.min)?.key;
  const matches = (story: (typeof stories)[number], skip?: 'age' | 'theme') =>
    (skip === 'age' || !filter || overlaps(story, filter)) &&
    (!collection || story.collectionIds.includes(collection.slug)) &&
    (skip === 'theme' || !theme || matchesTheme(story, theme.key)) &&
    (!search || matchesSearch(story, search));
  const visible = stories.filter((story) => matches(story));
  const ageCount = (range: { min: number; max: number }) =>
    stories.filter((story) => matches(story, 'age') && overlaps(story, range)).length;
  const themeCount = (key: string) =>
    stories.filter((story) => matches(story, 'theme') && matchesTheme(story, key)).length;
  const allAgesCount = stories.filter((story) => matches(story, 'age')).length;
  const allThemesCount = stories.filter((story) => matches(story, 'theme')).length;
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
    return Object.keys(merged).length > 0 ? { pathname: base, query: merged } : base;
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

      {/* Buscar y edad en una fila; los temas, como barra de categorías fija al hacer scroll. */}
      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <form role="search" action="" className="relative min-w-0 lg:w-full lg:max-w-md">
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
            className="h-12 w-full rounded-xl border bg-card pr-24 pl-12 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <button
            type="submit"
            className="absolute top-1.5 right-1.5 h-9 rounded-lg bg-action px-4 text-sm font-semibold text-action-foreground transition hover:bg-action-hover"
          >
            {t('search')}
          </button>
          {filter && <input type="hidden" name="edad" value={filter.min} />}
          {collection && <input type="hidden" name="coleccion" value={collection.slug} />}
          {theme && <input type="hidden" name="tema" value={theme.key} />}
        </form>

        <nav
          aria-label={t('filterLabel')}
          className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:pb-0"
        >
          <div className="inline-flex rounded-xl bg-muted p-1">
            {[
              { range: null, label: t('allAgesOption'), count: allAgesCount },
              ...AGE_FILTERS.map((range) => ({
                range,
                label: `${t(`stages.${range.key}`)} ${String(range.min)}–${String(range.max)}`,
                count: ageCount(range),
              })),
            ].map(({ range, label, count }) => {
              const active = range ? filter?.min === range.min : !filter;
              const disabled = !active && count === 0;
              const className = cn(
                'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold whitespace-nowrap transition',
                active ? 'bg-card text-foreground shadow-sm' : 'text-foreground/70',
                disabled ? 'pointer-events-none opacity-40' : !active && 'hover:text-foreground',
              );
              const content = (
                <>
                  {label}
                  <span className="text-xs font-medium text-muted-foreground tabular-nums">
                    {count}
                  </span>
                </>
              );
              return disabled ? (
                <span key={label} aria-disabled="true" className={className}>
                  {content}
                </span>
              ) : (
                <Link
                  key={label}
                  href={withQuery({ edad: range ? String(range.min) : undefined })}
                  data-track="catalog_filter_used"
                  data-track-filter="age"
                  aria-current={active ? 'true' : undefined}
                  aria-label={
                    range
                      ? `${t(`stages.${range.key}`)}, ${t('ageRange', { min: range.min, max: range.max })}`
                      : label
                  }
                  className={className}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      <nav
        aria-label={t('themeLabel')}
        className="sticky top-16 z-20 -mx-4 mt-6 overflow-x-auto border-b bg-background/95 px-4 backdrop-blur sm:mx-0 sm:px-0 lg:top-[4.75rem]"
      >
        <ul className="flex min-w-max gap-1 sm:gap-3">
          {[
            { key: null, icon: LayoutGrid, count: allThemesCount },
            ...STORY_THEMES.map(({ key, icon }) => ({ key, icon, count: themeCount(key) })),
          ].map(({ key, icon: Icon, count }) => {
            const active = key ? theme?.key === key : !theme;
            const disabled = !active && count === 0;
            const inner = (
              <>
                <Icon className="size-5" aria-hidden="true" />
                <span className="text-sm font-semibold whitespace-nowrap">
                  {key ? t(`themes.${key}`) : t('allThemes')}
                </span>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  {count}
                </span>
              </>
            );
            const className = cn(
              'flex min-h-16 flex-col items-center justify-center gap-0.5 border-b-2 px-3 pt-2 pb-1.5 transition',
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground/70 hover:border-foreground/20 hover:text-foreground',
              disabled && 'pointer-events-none opacity-40',
            );
            return (
              <li key={key ?? 'all'}>
                {disabled ? (
                  <span aria-disabled="true" className={className}>
                    {inner}
                  </span>
                ) : (
                  <Link
                    href={withQuery({ tema: key ?? undefined })}
                    data-track="catalog_filter_used"
                    data-track-filter="theme"
                    aria-current={active ? 'page' : undefined}
                    className={className}
                  >
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
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
          <Link href={base} className="mt-3 inline-block font-semibold text-primary">
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
              <Link href={base} className="ml-1 font-semibold text-primary hover:underline">
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
                lineLabel={channel ? undefined : tLines(story.channels[0] ?? 'families')}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
