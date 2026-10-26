'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useEffectEvent, useState } from 'react';

import type { Locale } from '@storynido/shared';

import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { getFirebaseDb } from '@/lib/firebase/client';
import { startAnonymousSession } from '@/lib/firebase/auth-actions';
import { createDraft, listDrafts, type DraftSummary } from '@/lib/firebase/drafts';

import { DraftsList } from './drafts-list';
import { SignInGate } from './sign-in-gate';

/**
 * Punto de entrada del creador. Sin sesión abre una anónima (se crea sin cuenta y se vincula
 * al iniciar sesión). Con una historia o enseñanza preseleccionada crea el borrador y entra
 * directo; si no, ofrece retomar un borrador o empezar uno nuevo.
 */
export function CreateStart({
  storyId,
  lessonId,
}: {
  storyId: string | null;
  lessonId: string | null;
}) {
  const t = useTranslations('Wizard');
  const locale = useLocale() as Locale;
  const { user, loading } = useAuth();
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  // Si la sesión anónima no está disponible (proveedor deshabilitado), se pide iniciar sesión.
  const [anonymousFailed, setAnonymousFailed] = useState(false);

  async function startNew() {
    if (!user) return;
    setBusy(true);
    const id = await createDraft(await getFirebaseDb(), user.uid, {
      language: locale,
      storyId,
      lessonId,
    });
    router.replace({ pathname: '/create/[bookId]', params: { bookId: id } });
  }

  const onUser = useEffectEvent(async () => {
    if (!user) return;
    if (storyId || lessonId) {
      await startNew();
      return;
    }
    const found = await listDrafts(await getFirebaseDb(), user.uid);
    if (found.length === 0) await startNew();
    else setDrafts(found);
  });

  useEffect(() => {
    // Al tener sesión: crear o listar borradores (lectura de Firestore después de montar).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) void onUser();
  }, [user]);

  useEffect(() => {
    if (loading || user) return;
    startAnonymousSession().catch(() => {
      setAnonymousFailed(true);
    });
  }, [loading, user]);

  if (anonymousFailed && !user) return <SignInGate />;
  if (!drafts) {
    return (
      <p role="status" className="container-page py-20 text-center text-muted-foreground">
        {t('loading')}
      </p>
    );
  }

  return (
    <section className="container-page max-w-2xl py-14">
      <h1 className="mb-8 text-3xl font-semibold sm:text-4xl">{t('drafts.title')}</h1>
      <DraftsList drafts={drafts} />
      <Button className="mt-8" size="lg" disabled={busy} onClick={() => void startNew()}>
        {t('drafts.startNew')}
      </Button>
    </section>
  );
}
