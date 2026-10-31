'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import type { Channel } from '@storynido/shared';

import { OrdersList } from '@/components/account/orders-list';
import { useAuth } from '@/components/auth/auth-provider';
import { ProPanel } from '@/components/pro/pro-panel';
import { useProStatus } from '@/components/pro/use-pro-status';
import { buttonVariants } from '@/components/ui/button';
import { DraftsList } from '@/components/wizard/drafts-list';
import { NewChoice } from '@/components/wizard/new-choice';
import { Link, useRouter } from '@/i18n/navigation';
import { getFirebaseDb } from '@/lib/firebase/client';
import { isEmptyDraft, listDrafts, type DraftSummary } from '@/lib/firebase/drafts';
import { cn } from '@/lib/utils';

/**
 * Mis cuentos: la home de quien tiene sesión (auditoría UX, DECISIONS 110). Lo que creó en cada
 * línea para retomar o borrar, "Nuevo" con las tres líneas y sus pedidos. Los ajustes quedan en
 * Mi cuenta.
 */
export default function MyStoriesPage() {
  const t = useTranslations('Account.myStories');
  const tLines = useTranslations('Nav.lines');
  const { user, signedIn, loading } = useAuth();
  const router = useRouter();
  const { status: pro } = useProStatus();
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  const [line, setLine] = useState<Channel | 'all'>('all');
  const [failed, setFailed] = useState(false);

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
  }, [user]);

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
  const lines = [...new Set(drafts.map((draft) => draft.channel))];
  const shown = line === 'all' ? drafts : drafts.filter((draft) => draft.channel === line);
  const latest = drafts[0];

  return (
    <section className="container-page grid max-w-3xl gap-10 py-12">
      <h1 className="text-3xl font-medium sm:text-4xl">{t('title')}</h1>

      <section id="new" aria-labelledby="new-title" className="grid scroll-mt-28 gap-4">
        <h2 id="new-title" className="text-2xl font-medium">
          {t('newTitle')}
        </h2>
        <NewChoice />
      </section>

      {failed && (
        <p role="alert" className="rounded-xl bg-muted p-4 text-sm">
          {t('loadFailed')}
        </p>
      )}

      {latest ? (
        <>
          <section aria-labelledby="resume" className="rounded-xl bg-secondary p-6">
            <h2 id="resume" className="text-sm font-bold tracking-wide uppercase">
              {t('resume')}
            </h2>
            <p className="mt-2 font-display text-xl font-semibold">
              {latest.childName ? t('storyOf', { name: latest.childName }) : t('untitled')}
            </p>
            <Link
              href={{ pathname: '/create/[bookId]', params: { bookId: latest.id } }}
              className={cn(buttonVariants({ size: 'lg' }), 'mt-4')}
            >
              {t('continue')}
            </Link>
          </section>

          <section id="drafts" aria-labelledby="drafts-title" className="grid scroll-mt-28 gap-4">
            <h2 id="drafts-title" className="text-2xl font-medium">
              {t('inProgress')}
            </h2>
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
          </section>
        </>
      ) : null}

      {pro?.accountType === 'professional' && <ProPanel uid={user.uid} status={pro} />}
      <OrdersList uid={user.uid} />
    </section>
  );
}
