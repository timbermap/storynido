'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { CharactersList } from '@/components/account/characters-list';
import { useAuth } from '@/components/auth/auth-provider';
import { FinishedStories } from '@/components/account/finished-stories';
import { useOrderCounts } from '@/components/layout/use-account-activity';
import { DraftsList } from '@/components/wizard/drafts-list';
import { NewChoice } from '@/components/wizard/new-choice';
import { useRouter } from '@/i18n/navigation';
import { getFirebaseDb } from '@/lib/firebase/client';
import { isEmptyDraft, listDrafts, type DraftSummary } from '@/lib/firebase/drafts';

/**
 * Mis cuentos: la home de quien tiene sesión (auditoría UX, DECISIONS 110). Lo que creó en cada
 * línea para retomar o borrar y sus personajes; las tres líneas para empezar solo si todavía no hay
 * nada. Los pedidos tienen su propia página. Los ajustes quedan en
 * Mi cuenta.
 */
export default function MyStoriesPage() {
  const t = useTranslations('Account.myStories');
  const { user, signedIn, loading } = useAuth();
  const router = useRouter();
  const orders = useOrderCounts();
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloads, setReloads] = useState(0);

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

  const open = drafts;

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

      {/* Dos bloques, sin importar la línea: lo que está en curso y lo que ya está terminado. */}
      {open.length > 0 && (
        <section id="drafts" aria-labelledby="drafts-title" className="grid scroll-mt-28 gap-4">
          <h2 id="drafts-title" className="text-2xl font-medium">
            {t('inProgress')} ({open.length})
          </h2>
          <DraftsList
            drafts={open}
            onDeleted={(id) => {
              setDrafts((current) => current?.filter((draft) => draft.id !== id) ?? null);
            }}
          />
        </section>
      )}

      <FinishedStories uid={user.uid} />

      <section
        id="characters"
        aria-labelledby="characters-title"
        className="grid scroll-mt-28 gap-4"
      >
        <h2 id="characters-title" className="text-2xl font-medium">
          {t('tabCharacters')}
        </h2>
        <CharactersList
          uid={user.uid}
          onDeleted={() => {
            setReloads((count) => count + 1);
          }}
        />
      </section>
    </section>
  );
}
