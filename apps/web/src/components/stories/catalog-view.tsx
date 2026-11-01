import { getTranslations } from 'next-intl/server';

import { AGE_STAGES, stageOf, type Channel, type Locale } from '@storynido/shared';

import { CountryNotice } from '@/components/stories/country-notice';
import { StoryCard } from '@/components/stories/story-card';
import { VisitorNameField } from '@/components/stories/visitor-name-field';
import { Search, X } from 'lucide-react';

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

/** Desde cuántas historias de una línea se muestra el buscador. */
const SEARCH_MIN_STORIES = 40;

export async function CatalogView({ locale, query, base, channel }: CatalogProps) {
  const t = await getTranslations('Stories');
  const tLines = await getTranslations('Nav.lines');
  // "Todas las edades" llega como `edad=` vacío: no es la franja de 0 a 3.
  const requested = query.edad ? Number(query.edad) : Number.NaN;
  const filter = AGE_FILTERS.find((f) => f.min === requested);
  const display = await getDisplayCountry(locale);

  // Se filtra por el rango completo: una historia aplica si se superpone con el rango elegido.
  // El catálogo es la tienda de Familias, con sus colecciones.
  const [allStories, offer, allCollections] = await Promise.all([
    getStories(locale, undefined, channel ? { channel } : {}),
    getOffer(display.country, locale),
    getCollections(locale, channel ?? 'families').catch(() => []),
  ]);
  // Cada catálogo muestra las historias cuya casa principal es esa línea (la primera de `channels`);
  // las que viven en dos líneas aparecen en la otra solo por búsqueda y enseñanzas (DECISIONS 150).
  const stories = channel
    ? allStories.filter((story) => story.channels[0] === channel)
    : allStories;
  // El buscador aparece cuando hay historias de sobra para que valga la pena (con pocas, el filtro
  // por edad y los temas alcanzan).
  const showSearch = stories.length >= SEARCH_MIN_STORIES || Boolean(query.q);
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
  // De menor a mayor edad (a igual edad, el orden del catálogo).
  const visible = stories
    .filter((story) => matches(story))
    .sort((a, b) => a.ageMin - b.ageMin || a.ageMax - b.ageMax);
  const ageCount = (range: { min: number; max: number }) =>
    stories.filter((story) => matches(story, 'age') && overlaps(story, range)).length;
  const themeCount = (key: string) =>
    stories.filter((story) => matches(story, 'theme') && matchesTheme(story, key)).length;
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

  return (
    <div className="container-page py-14">
      <header className="max-w-2xl">
        <h1 className="text-4xl font-medium sm:text-5xl">{t('title')}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t('subtitle')}</p>
        <VisitorNameField className="mt-6" />
        <div className="mt-4">
          <CountryNotice display={display} />
        </div>
      </header>

      {/* Buscar; después "¿Para quién es?" (la edad define estilo y texto) y los temas como chips. */}
      {showSearch && (
        <form role="search" action="" className="relative mt-8 max-w-md min-w-0">
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
            className="h-12 w-full rounded-full border bg-card pr-24 pl-12 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <button
            type="submit"
            className="absolute top-1.5 right-1.5 h-9 rounded-full bg-action px-4 text-sm font-semibold text-action-foreground transition hover:bg-action-hover"
          >
            {t('search')}
          </button>
          {filter && <input type="hidden" name="edad" value={filter.min} />}
          {collection && <input type="hidden" name="coleccion" value={collection.slug} />}
          {theme && <input type="hidden" name="tema" value={theme.key} />}
        </form>
      )}

      <nav aria-label={t('filterLabel')} className="mt-8">
        <p className="mb-3 font-display text-lg font-bold">{t('askWho')}</p>
        <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          {AGE_FILTERS.map((range) => {
            const count = ageCount(range);
            const active = filter?.min === range.min;
            const disabled = !active && count === 0;
            const className = cn(
              'flex h-full flex-col gap-0.5 rounded-2xl border p-3.5 text-left transition',
              active ? 'border-primary bg-primary/15' : 'bg-card hover:border-foreground/30',
              disabled && 'pointer-events-none opacity-40',
            );
            const inner = (
              <>
                <span className="font-display text-lg leading-tight font-bold">
                  {t(`stages.${range.key}`)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t('ageRange', { min: range.min, max: range.max })}
                </span>
                <span className="mt-1 text-xs font-bold text-primary tabular-nums">
                  {t('resultCount', { count })}
                </span>
              </>
            );
            return (
              <li key={range.key}>
                {disabled ? (
                  <span aria-disabled="true" className={className}>
                    {inner}
                  </span>
                ) : (
                  <Link
                    // Tocar la edad elegida la quita.
                    href={withQuery({ edad: active ? undefined : String(range.min) })}
                    data-track="catalog_filter_used"
                    data-track-filter="age"
                    aria-current={active ? 'true' : undefined}
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

      <nav aria-label={t('themeLabel')} className="mt-6">
        <p className="mb-3 text-xs font-bold tracking-wider text-muted-foreground uppercase">
          {t('themeLabel')}
        </p>
        <ul className="flex flex-wrap gap-2">
          {STORY_THEMES.map(({ key, icon: Icon }) => {
            const count = themeCount(key);
            const active = theme?.key === key;
            const disabled = !active && count === 0;
            const className = cn(
              'inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition',
              active
                ? 'border-secondary bg-secondary text-secondary-foreground'
                : 'bg-card hover:border-foreground/30',
              disabled && 'pointer-events-none opacity-40',
            );
            const inner = (
              <>
                <Icon className="size-4" aria-hidden="true" />
                {t(`themes.${key}`)}
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  {count}
                </span>
              </>
            );
            return (
              <li key={key}>
                {disabled ? (
                  <span aria-disabled="true" className={className}>
                    {inner}
                  </span>
                ) : (
                  <Link
                    // Tocar el tema elegido lo quita.
                    href={withQuery({ tema: active ? undefined : key })}
                    data-track="catalog_filter_used"
                    data-track-filter="theme"
                    aria-current={active ? 'true' : undefined}
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
                fromPrice={lowestPrice(offer, locale, display.country, story.lengths)}
                headingLevel="h2"
                priority={index < 2}
                lineLabel={channel ? undefined : tLines(story.channels[0] ?? 'families')}
                line={channel}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
