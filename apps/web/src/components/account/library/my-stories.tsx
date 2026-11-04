'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PublicStory } from '@storynido/shared';

import { useAuth } from '@/components/auth/auth-provider';
import type { LineCopy } from '@/components/home/session/parts';
import { useRouter } from '@/i18n/navigation';
import { getFirebaseDb } from '@/lib/firebase/client';
import { readDraftState } from '@/lib/firebase/drafts';
import { loadLibraryData, type LibraryData } from '@/lib/firebase/library-data';
import { AUDIENCE_TONES } from '@/lib/audience-tones';
import { HOME_CHANNELS, type HomeChannel } from '@/lib/home-state';
import { linesUsed, orderShelf, pickNextUp } from '@/lib/library';
import { defaultMyStoriesTab, parseMyStoriesTab, type MyStoriesTab } from '@/lib/my-stories-tabs';
import { cn } from '@/lib/utils';

import { CharactersPanel } from './characters-panel';
import { Ideas } from './ideas';
import { DraftCard, OrderCard, ShelfItem } from './library-items';
import { NextUp } from './next-up';
import { EmptyState, Welcome } from './empty-states';

/** Esqueleto mientras se lee la cuenta (nunca una página vacía). */
export function MyStoriesSkeleton() {
  const t = useTranslations('Account.myStories');
  return (
    <div className="container-page grid gap-8 py-8 font-sans lg:py-12" role="status">
      <span className="sr-only">{t('loading')}</span>
      <div className="grid gap-3">
        <div className="h-7 w-32 rounded-lg bg-border" />
        <div className="h-10 w-3/4 max-w-md rounded-xl bg-border" />
      </div>
      <div className="h-36 rounded-[1.375rem] bg-border/60" />
      <div className="h-11 rounded-xl bg-border/60" />
      <div className="grid gap-3">
        {[0, 1].map((key) => (
          <div key={key} className="h-28 rounded-2xl bg-border/60" />
        ))}
      </div>
    </div>
  );
}

const EMPTY: LibraryData = { books: [], orders: [], children: [] };

/**
 * Mis cuentos: saludo, «Lo próximo» (lo que pide una acción, con el único botón durazno), las
 * solapas con su contador, el filtro por línea (solo si la cuenta usó más de una), las ideas para
 * el personaje más reciente y la línea de confianza.
 */
export function MyStories({ stories, lines }: { stories: PublicStory[]; lines: LineCopy }) {
  const t = useTranslations('Account.myStories');
  const tLib = useTranslations('Account.myStories.library');
  const { user, signedIn, loading } = useAuth();
  const router = useRouter();
  const requested = parseMyStoriesTab(useSearchParams().get('estado'));
  const [data, setData] = useState<LibraryData | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloads, setReloads] = useState(0);
  const [line, setLine] = useState<HomeChannel | 'all'>('all');
  const reload = useCallback(() => {
    setReloads((count) => count + 1);
  }, []);

  useEffect(() => {
    if (!loading && !signedIn) router.replace('/login');
  }, [loading, signedIn, router]);

  useEffect(() => {
    if (!user || !signedIn) return;
    let cancelled = false;
    // Sin respuesta en 12 s se muestra la página igual, con el aviso de que no se pudo leer.
    const timer = setTimeout(() => {
      if (cancelled) return;
      setFailed(true);
      setData((current) => current ?? EMPTY);
    }, 12_000);
    void getFirebaseDb()
      .then((db) => loadLibraryData(db, user.uid))
      .then((found) => {
        if (cancelled) return;
        setFailed(false);
        setData(found);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setData((current) => current ?? EMPTY);
      })
      .finally(() => {
        clearTimeout(timer);
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user, signedIn, reloads]);

  // Mientras se dibuja una muestra se consulta su estado; al terminar se vuelve a leer todo.
  const generating =
    data?.books
      .filter((book) => book.stage === 'generating')
      .map((book) => book.id)
      .join(',') ?? '';
  useEffect(() => {
    if (!generating) return;
    const timer = setInterval(() => {
      void getFirebaseDb().then(async (db) => {
        const states = await Promise.all(
          generating.split(',').map((id) => readDraftState(db, id).catch(() => null)),
        );
        if (states.some((state) => !state?.generating)) reload();
      });
    }, 8000);
    return () => {
      clearInterval(timer);
    };
  }, [generating, reload]);

  const view = useMemo(() => {
    if (!data) return null;
    return {
      used: linesUsed(data.books, data.orders),
      books: data.books,
      inProgress: data.orders.filter((order) => orderShelf(order) === 'inProgress'),
      done: data.orders.filter((order) => orderShelf(order) === 'done'),
      next: pickNextUp(data.books),
      total: new Set([
        ...data.books.map((book) => book.id),
        ...data.orders.filter((order) => orderShelf(order) !== null).map((order) => order.bookId),
      ]).size,
    };
  }, [data]);

  if (loading || !user || !signedIn || !data || !view) return <MyStoriesSkeleton />;

  const first = user.displayName?.trim().split(/\s+/)[0] ?? null;
  const child = data.children[0] ?? null;
  const empty = view.total === 0 && data.children.length === 0;
  const allInProgress = data.orders.filter((order) => orderShelf(order) === 'inProgress').length;
  const tab = requested ?? defaultMyStoriesTab(data.books.length, allInProgress);
  const tabs: { key: MyStoriesTab; label: string; count: number }[] = [
    { key: 'en-creacion', label: t('tabCreating'), count: view.books.length },
    { key: 'en-curso', label: t('tabInProgress'), count: view.inProgress.length },
    { key: 'terminados', label: t('tabDone'), count: view.done.length },
    { key: 'personajes', label: t('tabCharacters'), count: data.children.length },
  ];
  // Filtro por línea: solo si la solapa abierta tiene cuentos de 2 o más líneas (nunca en una vacía).
  const tabItems: readonly { channel: HomeChannel }[] =
    tab === 'en-creacion'
      ? view.books
      : tab === 'en-curso'
        ? view.inProgress
        : tab === 'terminados'
          ? view.done
          : [];
  const tabLines = HOME_CHANNELS.filter((item) => tabItems.some((x) => x.channel === item));
  const active = line !== 'all' && tabLines.includes(line) ? line : 'all';
  const inLine = (item: { channel: HomeChannel }) => active === 'all' || item.channel === active;
  const shown = {
    books: view.books.filter(inLine),
    inProgress: view.inProgress.filter(inLine),
    done: view.done.filter(inLine),
  };
  const selectTab = (key: MyStoriesTab) => {
    router.replace({ pathname: '/my-stories', query: { estado: key } }, { scroll: false });
  };
  const story = (slug: string | null) => stories.find((item) => item.slug === slug);
  // Sin nada todavía, el botón durazno es el de «Crear una vista previa gratis».
  const onlyPro = view.used.length > 0 && view.used.every((item) => item === 'professionals');

  return (
    <div className="container-page grid gap-8 pt-6 pb-14 font-sans sm:gap-10 lg:pt-10">
      <header className="grid gap-1">
        {first && (
          <p className="font-script text-[1.65rem] leading-none text-primary">
            {t('hello', { name: first })}
          </p>
        )}
        <h1 className="text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.1] font-bold tracking-[-0.01em]">
          {t('title')}
        </h1>
        {!empty && (
          <p className="text-muted-foreground">
            {tLib('summary', { books: view.total, characters: data.children.length })}
          </p>
        )}
      </header>

      {failed && (
        <p role="alert" className="rounded-xl bg-muted p-4 text-sm">
          {t('loadFailed')}
        </p>
      )}

      {view.next && <NextUp next={view.next} lines={lines} stories={stories} />}

      {empty && <Welcome />}

      {/* Solapas por estado y los personajes. Sin nada todavía, solo si se pidió una por el link. */}
      {(!empty || requested !== null) && (
        <section id="drafts" aria-label={t('title')} className="grid scroll-mt-28 gap-5">
          <div
            role="tablist"
            aria-label={t('title')}
            className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0"
          >
            {tabs.map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`tab-${key}`}
                aria-selected={tab === key}
                aria-controls={`panel-${key}`}
                onClick={() => {
                  selectTab(key);
                }}
                className={cn(
                  '-mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-2.5 font-semibold whitespace-nowrap transition sm:gap-2 sm:px-4 sm:text-lg',
                  key === 'personajes' && 'sm:ml-auto',
                  tab === key
                    ? 'border-navy text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
                <span className="grid min-w-6 place-items-center rounded-full bg-muted px-1.5 text-xs leading-5 font-bold text-muted-foreground">
                  {count}
                </span>
              </button>
            ))}
          </div>

          {tabLines.length > 1 && (
            <div role="group" aria-label={t('filter')} className="flex flex-wrap gap-1.5">
              {(['all', ...tabLines] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active === key}
                  onClick={() => {
                    setLine(key);
                  }}
                  // Filtro, no botón: chico, sin borde fuerte; la línea con su puntito de color.
                  className={cn(
                    'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors',
                    active === key
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {key !== 'all' && (
                    <span
                      aria-hidden="true"
                      className={cn('size-2 rounded-full', AUDIENCE_TONES[key].dot)}
                    />
                  )}
                  {key === 'all' ? tLib('filterAll') : lines[key].chip}
                </button>
              ))}
            </div>
          )}

          <div
            role="tabpanel"
            id={`panel-${tab}`}
            aria-labelledby={`tab-${tab}`}
            className="grid gap-4"
          >
            {tab === 'en-creacion' &&
              (shown.books.length === 0 ? (
                <EmptyState kind="creating" child={child} hasIdeas={Boolean(child) && !onlyPro} />
              ) : (
                <ul className="grid gap-3">
                  {shown.books.map((book) => (
                    <DraftCard
                      key={book.id}
                      book={book}
                      lines={lines}
                      story={story(book.storyId)}
                      onDeleted={() => {
                        setData((current) =>
                          current
                            ? { ...current, books: current.books.filter((b) => b.id !== book.id) }
                            : current,
                        );
                      }}
                    />
                  ))}
                </ul>
              ))}
            {tab === 'en-curso' &&
              (shown.inProgress.length === 0 ? (
                <EmptyState kind="inProgress" child={null} />
              ) : (
                <ul className="grid gap-3">
                  {shown.inProgress.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      lines={lines}
                      story={story(order.storyId)}
                    />
                  ))}
                </ul>
              ))}
            {tab === 'terminados' &&
              (shown.done.length === 0 ? (
                <EmptyState kind="done" child={null} />
              ) : (
                <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                  {shown.done.map((order) => (
                    <ShelfItem
                      key={order.id}
                      order={order}
                      lines={lines}
                      story={story(order.storyId)}
                    />
                  ))}
                </ul>
              ))}
            {tab === 'personajes' && (
              <CharactersPanel characters={data.children} onDeleted={reload} />
            )}
          </div>
        </section>
      )}

      {child && !onlyPro && (
        <Ideas
          child={child}
          hasKit={[...data.books, ...data.orders].some(
            (item) => item.channel === 'events' && item.childName === child.name,
          )}
        />
      )}

      {/* Confianza: una línea, no una sección. */}
      <ul className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-5 text-[0.92rem] text-muted-foreground">
        {(['preview', 'photos', 'reorder'] as const).map((key) => (
          <li key={key} className="inline-flex items-center gap-2">
            <Check className="size-[18px] shrink-0 text-success" aria-hidden="true" />
            {tLib(`trust.${key}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}
