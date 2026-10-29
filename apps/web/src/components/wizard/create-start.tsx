'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useEffectEvent, useState } from 'react';

import type { Channel, Locale } from '@storynido/shared';

import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { getFirebaseDb } from '@/lib/firebase/client';
import { startAnonymousSession } from '@/lib/firebase/auth-actions';
import { createDraft, isEmptyDraft, listDrafts, type DraftSummary } from '@/lib/firebase/drafts';

import { CHANNEL_STORAGE_KEY } from '@/components/landing/remember-channel';
import { ProActivationCard } from '@/components/pro/pro-activation';
import { useProStatus } from '@/components/pro/use-pro-status';

import { DraftsList } from './drafts-list';
import { SignInGate } from './sign-in-gate';

function rememberedChannel(): Channel | null {
  try {
    const value = window.sessionStorage.getItem(CHANNEL_STORAGE_KEY);
    return value === 'events' || value === 'professionals' || value === 'families' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Punto de entrada del creador. Sin sesión abre una anónima (se crea sin cuenta y se vincula
 * al iniciar sesión). Con una historia o enseñanza preseleccionada crea el borrador y entra
 * directo; si no, ofrece retomar un borrador o empezar uno nuevo.
 */
export function CreateStart({
  storyId,
  lessonId,
  channel: channelParam,
  proGate,
}: {
  storyId: string | null;
  lessonId: string | null;
  /** Línea pedida en la URL (?line=); si no, la recordada de la landing, o Familias. */
  channel: Channel | null;
  /** Textos de la puerta de cuenta de Profesionales. */
  proGate: { title: string; text: string };
}) {
  const t = useTranslations('Wizard');
  const locale = useLocale() as Locale;
  const { user, signedIn, loading } = useAuth();
  const [channel, setChannel] = useState<Channel>(channelParam ?? 'families');
  useEffect(() => {
    // La línea recordada de la landing se lee después de montar (sessionStorage).
    const remembered = channelParam ? null : rememberedChannel();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (remembered) setChannel(remembered);
  }, [channelParam]);
  // Profesionales necesita cuenta desde el inicio: sus compras se acumulan para el descuento.
  const needsAccount = channel === 'professionals';
  // ...y cuenta Pro activa (perfil mínimo) antes del primer borrador.
  const { status: pro, refresh: refreshPro } = useProStatus();
  const proReady = !needsAccount || pro?.accountType === 'professional';
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
      channel,
    });
    router.replace({ pathname: '/create/[bookId]', params: { bookId: id } });
  }

  const onUser = useEffectEvent(async () => {
    if (!user || (needsAccount && !signedIn) || !proReady) return;
    if (storyId || lessonId) {
      await startNew();
      return;
    }
    // Desde el botón de una línea (?line=) solo cuentan los borradores de esa línea.
    const all = await listDrafts(await getFirebaseDb(), user.uid);
    const found = channelParam ? all.filter((draft) => draft.channel === channelParam) : all;
    const empty = found.find(isEmptyDraft);
    if (empty) {
      // Un intento anterior que no pasó del primer paso: se sigue ahí, sin listarlo.
      router.replace({ pathname: '/create/[bookId]', params: { bookId: empty.id } });
      return;
    }
    if (found.length === 0) await startNew();
    else setDrafts(found);
  });

  useEffect(() => {
    // Al tener sesión: crear o listar borradores (lectura de Firestore después de montar).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) void onUser();
  }, [user, signedIn, proReady]);

  useEffect(() => {
    if (loading || user || needsAccount) return;
    startAnonymousSession().catch(() => {
      setAnonymousFailed(true);
    });
  }, [loading, user, needsAccount]);

  if (!loading && needsAccount && !signedIn) {
    return <SignInGate title={proGate.title} text={proGate.text} />;
  }
  if (needsAccount && pro?.accountType === 'family') {
    return <ProActivationCard onActivated={() => void refreshPro()} />;
  }
  if (anonymousFailed && !user) return <SignInGate />;
  if (!drafts) {
    return (
      <p
        role="status"
        className="container-page min-h-[80vh] py-20 text-center text-muted-foreground"
      >
        {t('loading')}
      </p>
    );
  }

  return (
    <section className="container-page max-w-2xl py-14">
      <h1 className="mb-8 text-3xl font-medium sm:text-4xl">{t('drafts.title')}</h1>
      <DraftsList drafts={drafts.filter((draft) => !isEmptyDraft(draft))} />
      <Button className="mt-8" size="lg" disabled={busy} onClick={() => void startNew()}>
        {t('drafts.startNew')}
      </Button>
    </section>
  );
}
