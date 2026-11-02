'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import type { Channel } from '@storynido/shared';

import { CharactersList } from '@/components/account/characters-list';
import { useAuth } from '@/components/auth/auth-provider';
import { ProPanel } from '@/components/pro/pro-panel';
import { useOrderCounts } from '@/components/layout/use-account-activity';
import { useProStatus } from '@/components/pro/use-pro-status';
import { DraftsList } from '@/components/wizard/drafts-list';
import { NewChoice } from '@/components/wizard/new-choice';
import { useRouter } from '@/i18n/navigation';
import { getFirebaseDb } from '@/lib/firebase/client';
import { isEmptyDraft, listDrafts, type DraftSummary } from '@/lib/firebase/drafts';
import { cn } from '@/lib/utils';

/**
 * Mis cuentos: la home de quien tiene sesión (auditoría UX, DECISIONS 110). Lo que creó en cada
 * línea para retomar o borrar y sus personajes; las tres líneas para empezar solo si todavía no hay
 * nada. Los pedidos tienen su propia página. Los ajustes quedan en
 * Mi cuenta.
 */
export default function MyStoriesPage() {
  const t = useTranslations('Account.myStories');
  const tLines = useTranslations('Nav.lines');
  const { user, signedIn, loading } = useAuth();
  const router = useRouter();
  const { status: pro } = useProStatus();
  const orders = useOrderCounts();
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  const [line, setLine] = useState<Channel | 'all'>('all');
  const [failed, setFailed] = useState(false);
  const [reloads, setReloads] = useState(0);
  const [tab, setTab] = useState<'drafts' | 'characters'>('drafts');
  // Libros que ya se ven dentro de «Tus proyectos» (Profesionales): no se repiten en «En proceso».
  const [projectBooks, setProjectBooks] = useState<Set<string>>(new Set());
  const onProjectBooks = useCallback((ids: Set<string>) => {
    setProjectBooks(ids);
  }, []);

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

  if (loading || !user || !signedIn || !drafts) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <p role="status" className="text-muted-foreground">
          {t('loading')}
        </p>
      </section>
    );
  }

  // Filtro por línea solo para quien usó más de una.
  const open = drafts.filter((draft) => !projectBooks.has(draft.id));
  const lines = [...new Set(open.map((draft) => draft.channel))];
  const shown = line === 'all' ? open : open.filter((draft) => draft.channel === line);

  return (
    <section className="container-page grid max-w-3xl gap-10 py-12">
      <h1 className="text-3xl font-medium sm:text-4xl">{t('title')}</h1>

      {/* «¿Qué quieres crear?» solo para quien todavía no tiene cuentos ni pedidos: después, «Crear» del
          navbar y la home ya llevan al siguiente paso. */}
      {open.length === 0 && orders !== null && orders.total === 0 && (
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

      {/* Solapas: lo que está en proceso y los personajes creados. Sin el bloque «Sigue donde lo
          dejaste»: repetía el primer borrador de la lista. */}
      {(open.length > 0 || tab === 'characters') && (
        <section id="drafts" className="grid scroll-mt-28 gap-4">
          <div role="tablist" aria-label={t('title')} className="flex gap-2 border-b">
            {(
              [
                ['drafts', `${t('tabDrafts')} (${String(open.length)})`],
                ['characters', t('tabCharacters')],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`tab-${key}`}
                aria-selected={tab === key}
                aria-controls={`panel-${key}`}
                onClick={() => {
                  setTab(key);
                }}
                className={cn(
                  '-mb-px min-h-11 border-b-2 px-4 text-lg font-medium transition',
                  tab === key
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'drafts' ? (
            <div
              role="tabpanel"
              id="panel-drafts"
              aria-labelledby="tab-drafts"
              className="grid gap-4"
            >
              {lines.length > 1 && (
                <div role="group" aria-label={t('filter')} className="flex flex-wrap gap-2">
                  {(['all', ...lines] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={line === item}
                      onClick={() => {
                        setLine(item);
                      }}
                      className={cn(
                        'min-h-9 rounded-full px-4 text-sm font-semibold transition',
                        line === item
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-secondary',
                      )}
                    >
                      {item === 'all' ? t('all') : tLines(item)}
                    </button>
                  ))}
                </div>
              )}
              <DraftsList
                drafts={shown}
                onDeleted={(id) => {
                  setDrafts((current) => current?.filter((draft) => draft.id !== id) ?? null);
                }}
              />
            </div>
          ) : (
            <div
              role="tabpanel"
              id="panel-characters"
              aria-labelledby="tab-characters"
              className="grid gap-4"
            >
              <CharactersList
                uid={user.uid}
                onDeleted={() => {
                  setReloads((count) => count + 1);
                }}
              />
            </div>
          )}
        </section>
      )}

      {pro?.accountType === 'professional' && (
        <ProPanel uid={user.uid} status={pro} onBooks={onProjectBooks} />
      )}
    </section>
  );
}
