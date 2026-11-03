'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { CharactersList } from '@/components/account/characters-list';
import { FinishedStories } from '@/components/account/finished-stories';
import { OrdersList } from '@/components/account/orders-list';
import { useAuth } from '@/components/auth/auth-provider';
import { useOrderCounts } from '@/components/layout/use-account-activity';
import { DraftsList } from '@/components/wizard/drafts-list';
import { NewChoice } from '@/components/wizard/new-choice';
import { useRouter } from '@/i18n/navigation';
import { getFirebaseDb } from '@/lib/firebase/client';
import { isEmptyDraft, listDrafts, type DraftSummary } from '@/lib/firebase/drafts';
import { defaultMyStoriesTab, parseMyStoriesTab, type MyStoriesTab } from '@/lib/my-stories-tabs';
import { cn } from '@/lib/utils';

function Loading() {
  const t = useTranslations('Account.myStories');
  return (
    <section className="flex min-h-[60vh] items-center justify-center">
      <p role="status" className="text-muted-foreground">
        {t('loading')}
      </p>
    </section>
  );
}

/**
 * Mis cuentos: la home de quien tiene sesión (auditoría UX, DECISIONS 110). Solapas por estado
 * (opción 1 del navbar): En creación (los borradores de cada línea para retomar o borrar), En curso
 * y Terminados (los pedidos) y los personajes; la solapa va en `?estado=`. Las tres líneas para
 * empezar solo si todavía no hay nada. Los ajustes quedan en Mi cuenta.
 */
export default function MyStoriesPage() {
  // useSearchParams pide un límite de Suspense para poder prerenderizar la página.
  return (
    <Suspense fallback={<Loading />}>
      <MyStories />
    </Suspense>
  );
}

function MyStories() {
  const t = useTranslations('Account.myStories');
  const { user, signedIn, loading } = useAuth();
  const router = useRouter();
  const orders = useOrderCounts();
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloads, setReloads] = useState(0);
  const requested = parseMyStoriesTab(useSearchParams().get('estado'));

  useEffect(() => {
    if (!loading && !signedIn) router.replace('/login');
  }, [loading, signedIn, router]);

  useEffect(() => {
    if (!user) return;
    // Sin respuesta en 12 s se muestra la página igual, con el aviso de que no se pudo leer la lista.
    const timer = setTimeout(() => {
      setFailed(true);
      setDrafts((current) => current ?? []);
    }, 12_000);
    void getFirebaseDb()
      .then((db) => listDrafts(db, user.uid))
      .then((found) => {
        clearTimeout(timer);
        setFailed(false);
        setDrafts(found.filter((draft) => !isEmptyDraft(draft)));
      })
      .catch(() => {
        clearTimeout(timer);
        // Sin la lista no se queda cargando: se avisa (los pedidos se muestran igual).
        setFailed(true);
        setDrafts([]);
      });
    return () => {
      clearTimeout(timer);
    };
  }, [user, reloads]);

  if (loading || !user || !signedIn || !drafts) return <Loading />;

  // Sin filtro por línea: cada tarjeta ya lleva su etiqueta (Familia, Celebración, Profesional).
  const open = drafts;
  const tab = requested ?? defaultMyStoriesTab(open.length, orders?.inProgress ?? 0);
  const empty = open.length === 0 && orders !== null && orders.total === 0;
  const tabs: { key: MyStoriesTab; label: string; count?: number }[] = [
    { key: 'en-creacion', label: t('tabCreating'), count: open.length },
    { key: 'en-curso', label: t('tabInProgress'), count: orders?.inProgress },
    { key: 'terminados', label: t('tabDone'), count: orders?.done },
    { key: 'personajes', label: t('tabCharacters') },
  ];
  const selectTab = (key: MyStoriesTab) => {
    router.replace({ pathname: '/my-stories', query: { estado: key } }, { scroll: false });
  };

  return (
    <section className="container-page grid max-w-3xl gap-10 py-12">
      <h1 className="text-3xl font-medium sm:text-4xl">{t('title')}</h1>

      {/* «¿Qué quieres crear?» solo para quien todavía no tiene cuentos ni pedidos: después, «Crear» del
          navbar y la home ya llevan al siguiente paso. */}
      {empty && (
        <section id="new" aria-labelledby="new-title" className="grid scroll-mt-28 gap-4">
          <h2 id="new-title" className="text-2xl font-medium">
            {t('newTitle')}
          </h2>
          <NewChoice />
        </section>
      )}

      {failed && (
        <p role="alert" className="rounded-xl bg-muted p-4 text-sm">
          {t('loadFailed')}
        </p>
      )}

      {/* Solapas por estado y los personajes. Sin nada todavía, solo si se pidió una por el link. */}
      {(!empty || requested !== null) && (
        <section id="drafts" className="grid scroll-mt-28 gap-4">
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
                  '-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 font-medium whitespace-nowrap transition sm:px-4 sm:text-lg',
                  key === 'personajes' && 'ml-auto',
                  tab === key
                    ? 'border-navy text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
                {count !== undefined && (
                  <span className="grid min-w-6 place-items-center rounded-full bg-muted px-1.5 text-xs leading-5 font-semibold text-muted-foreground">
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`panel-${tab}`}
            aria-labelledby={`tab-${tab}`}
            className="grid gap-4"
          >
            {tab === 'en-creacion' &&
              (open.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('emptyCreating')}</p>
              ) : (
                <DraftsList
                  drafts={open}
                  onDeleted={(id) => {
                    setDrafts((current) => current?.filter((draft) => draft.id !== id) ?? null);
                  }}
                />
              ))}
            {tab === 'en-curso' && (
              <OrdersList
                uid={user.uid}
                heading={null}
                showEmpty
                status="inProgress"
                emptyLabel={t('emptyInProgress')}
              />
            )}
            {tab === 'terminados' && (
              <FinishedStories uid={user.uid} heading={false} emptyLabel={t('emptyDone')} />
            )}
            {tab === 'personajes' && (
              <CharactersList
                uid={user.uid}
                onDeleted={() => {
                  setReloads((count) => count + 1);
                }}
              />
            )}
          </div>
        </section>
      )}
    </section>
  );
}
