'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useEffectEvent, useState } from 'react';

import { EMPTY_BIRTHDAY, type Channel, type Locale } from '@storynido/shared';

import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { getFirebaseDb } from '@/lib/firebase/client';
import type { WizardCatalog } from '@/lib/server/wizard-catalog';
import { isEmptyDraft, listDrafts, updateBook, type DraftSummary } from '@/lib/firebase/drafts';

import { CHANNEL_STORAGE_KEY } from '@/components/landing/remember-channel';
import { ProActivationCard } from '@/components/pro/pro-activation';
import { useProStatus } from '@/components/pro/use-pro-status';

import { DraftsList } from './drafts-list';
import { WizardSkeleton } from './wizard-skeleton';
import { Wizard } from './wizard';
import { SignInGate } from './sign-in-gate';

/** Más que esto preparando el borrador es un problema (red o permisos): se ofrece reintentar. */
const START_TIMEOUT_MS = 20_000;

/** La única línea en la que el usuario tiene borradores (null si ninguna o varias). */
function onlyLine(drafts: DraftSummary[]): Channel | null {
  const lines = new Set(drafts.map((draft) => draft.channel));
  return lines.size === 1 ? ([...lines][0] ?? null) : null;
}

function rememberedChannel(): Channel | null {
  try {
    const value = window.sessionStorage.getItem(CHANNEL_STORAGE_KEY);
    return value === 'events' || value === 'professionals' || value === 'families' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Punto de entrada del creador. Pide cuenta en todas las líneas (DECISIONS 106): sin sesiones
 * anónimas que gasten IA y con los borradores guardados en la cuenta. Con una historia o enseñanza preseleccionada crea el borrador y entra
 * directo; si no, ofrece retomar un borrador o empezar uno nuevo.
 */
export function CreateStart({
  storyId,
  lessonId,
  channel: channelParam,
  proGate,
  catalog,
  eventTheme = null,
}: {
  storyId: string | null;
  lessonId: string | null;
  /** Línea pedida en la URL (?line=); si no, la recordada de la landing, o Familias. */
  channel: Channel | null;
  /** Textos de la puerta de cuenta de Profesionales. */
  proGate: { title: string; text: string };
  catalog: WizardCatalog;
  /** Celebraciones: temática que viene de la tarjeta de un tema en la landing. */
  eventTheme?: string | null;
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
  // Profesionales necesita además la cuenta Pro activa (perfil mínimo) antes del primer borrador.
  const professional = channel === 'professionals';
  const { status: pro, refresh: refreshPro } = useProStatus();
  const proReady = !professional || pro?.accountType === 'professional';
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  // Si leer o crear el borrador falla (red, permisos), se avisa y se puede reintentar: nunca
  // queda en "Preparando tu cuento…" para siempre.
  const [failed, setFailed] = useState(false);

  // Borrador nuevo: el creador abre acá mismo, en memoria; se guarda en el primer paso.
  const [fresh, setFresh] = useState(false);
  function startNew() {
    setFresh(true);
  }

  const onUser = useEffectEvent(async () => {
    if (!user || !signedIn || !proReady) return;
    const db = await getFirebaseDb();
    const all = await listDrafts(db, user.uid);
    // Qué crear: la línea de la URL, la de la landing de la que viene, Familias si eligió una
    // historia, o la única que usó. Si no se sabe, se pregunta en /nuevo (DECISIONS 115).
    const line =
      channelParam ?? rememberedChannel() ?? (storyId || lessonId ? 'families' : onlyLine(all));
    if (!line) {
      router.replace('/new');
      return;
    }
    if (line !== channel) setChannel(line);
    if (storyId || lessonId || eventTheme) {
      // Con una historia (o temática) elegida: si hay un intento vacío de esta línea, se reutiliza (así entrar
      // varias veces desde las fichas no deja borradores vacíos sueltos).
      const reusable = all.find((draft) => draft.channel === line && isEmptyDraft(draft));
      if (!reusable) {
        startNew();
        return;
      }
      await updateBook(db, reusable.id, {
        ...(storyId ? { storyId } : {}),
        ...(lessonId ? { lessonIds: [lessonId] } : {}),
        ...(eventTheme && line === 'events'
          ? { event: { ...EMPTY_BIRTHDAY, theme: eventTheme } }
          : {}),
      });
      router.replace({ pathname: '/create/[bookId]', params: { bookId: reusable.id } });
      return;
    }
    // Solo cuentan los borradores de esa línea.
    const found = all.filter((draft) => draft.channel === line);
    const empty = found.find(isEmptyDraft);
    if (empty) {
      // Un intento anterior que no pasó del primer paso: se sigue ahí, sin listarlo.
      router.replace({ pathname: '/create/[bookId]', params: { bookId: empty.id } });
      return;
    }
    if (found.length === 0) startNew();
    else setDrafts(found);
  });

  const start = useEffectEvent(async () => {
    setFailed(false);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('timeout'));
      }, START_TIMEOUT_MS);
    });
    try {
      await Promise.race([onUser(), timeout]);
    } catch {
      setFailed(true);
      setBusy(false);
    } finally {
      clearTimeout(timer);
    }
  });

  useEffect(() => {
    // Al tener sesión: crear o listar borradores (lectura de Firestore después de montar).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) void start();
  }, [user, signedIn, proReady]);

  if (!loading && !signedIn) {
    return professional ? <SignInGate title={proGate.title} text={proGate.text} /> : <SignInGate />;
  }
  if (professional && pro?.accountType === 'family') {
    return <ProActivationCard onActivated={() => void refreshPro()} />;
  }
  if (fresh) {
    return (
      <Wizard
        bookId={null}
        preset={{ language: locale, storyId, lessonId, channel, eventTheme }}
        catalog={catalog}
      />
    );
  }
  if (failed) {
    return (
      <section className="container-page grid min-h-[60vh] max-w-md place-content-center gap-4 py-20 text-center">
        <p role="alert" className="text-lg">
          {t('startFailed')}
        </p>
        <Button
          size="lg"
          onClick={() => {
            // Recargar arranca una conexión nueva a Firestore (la anterior puede seguir en espera).
            window.location.reload();
          }}
        >
          {t('retry')}
        </Button>
      </section>
    );
  }
  if (!drafts) {
    return <WizardSkeleton />;
  }

  return (
    <section className="container-page max-w-2xl py-14">
      <h1 className="mb-4 text-3xl font-medium sm:text-4xl">{t('drafts.title')}</h1>
      <DraftsList
        drafts={drafts.filter((draft) => !isEmptyDraft(draft))}
        onDeleted={(id) => {
          setDrafts((current) => current?.filter((draft) => draft.id !== id) ?? null);
        }}
      />
      <Button className="mt-8" size="lg" disabled={busy} onClick={startNew}>
        {t('drafts.startNew')}
      </Button>
    </section>
  );
}
