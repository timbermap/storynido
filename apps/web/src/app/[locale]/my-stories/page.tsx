'use client';

import { BookHeart, Cake, GraduationCap, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import type { Channel } from '@storynido/shared';

import { OrdersList } from '@/components/account/orders-list';
import { useAuth } from '@/components/auth/auth-provider';
import { ProPanel } from '@/components/pro/pro-panel';
import { useProStatus } from '@/components/pro/use-pro-status';
import { buttonVariants } from '@/components/ui/button';
import { DraftsList, LINE_TONE } from '@/components/wizard/drafts-list';
import { Link, useRouter } from '@/i18n/navigation';
import { getFirebaseDb } from '@/lib/firebase/client';
import { isEmptyDraft, listDrafts, type DraftSummary } from '@/lib/firebase/drafts';
import { cn } from '@/lib/utils';

const NEW_OPTIONS: { line: Channel; icon: typeof BookHeart }[] = [
  { line: 'families', icon: BookHeart },
  { line: 'events', icon: Cake },
  { line: 'professionals', icon: GraduationCap },
];

/**
 * Mis cuentos: la home de quien tiene sesión (auditoría UX, DECISIONS 110). Lo que creó en cada
 * línea para retomar o borrar, sus pedidos y "Nuevo" con las tres líneas. Los ajustes quedan en
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
    void getFirebaseDb()
      .then((db) => listDrafts(db, user.uid))
      .then((found) => {
        setDrafts(found.filter((draft) => !isEmptyDraft(draft)));
      })
      .catch(() => {
        // Sin la lista no se queda cargando: se avisa (los pedidos se muestran igual).
        setFailed(true);
        setDrafts([]);
      });
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-medium sm:text-4xl">{t('title')}</h1>
        <a href="#new" className={buttonVariants({ size: 'lg' })}>
          <Plus aria-hidden="true" />
          {t('new')}
        </a>
      </div>

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
      ) : (
        <div className="rounded-xl border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <h2 className="text-2xl font-medium">{t('emptyTitle')}</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">{t('emptyText')}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/create" className={buttonVariants({ size: 'lg' })}>
              {t('emptyCta')}
            </Link>
            <Link href="/stories" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
              {t('browse')}
            </Link>
          </div>
        </div>
      )}

      {pro?.accountType === 'professional' && <ProPanel uid={user.uid} status={pro} />}
      <OrdersList uid={user.uid} />

      <section id="new" aria-labelledby="new-title" className="grid scroll-mt-28 gap-4">
        <h2 id="new-title" className="text-2xl font-medium">
          {t('newTitle')}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {NEW_OPTIONS.map(({ line: option, icon: Icon }) => (
            <li key={option}>
              <Link
                href={{ pathname: '/create', query: { line: option } }}
                className="flex h-full flex-col gap-2 rounded-xl border bg-card p-5 shadow-[var(--shadow-card)] transition hover:border-primary/40"
              >
                <span
                  className={cn('grid size-10 place-items-center rounded-full', LINE_TONE[option])}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="font-semibold">{t(`newOptions.${option}.title`)}</span>
                <span className="text-sm text-muted-foreground">
                  {t(`newOptions.${option}.text`)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
