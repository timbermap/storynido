'use client';

import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import type { CountryCode, Locale, Offer, PublicStory } from '@storynido/shared';

import { useAuth } from '@/components/auth/auth-provider';
import { CHANNEL_STORAGE_KEY } from '@/components/landing/remember-channel';
import { useRouter } from '@/i18n/navigation';
import { getFirebaseDb } from '@/lib/firebase/client';
import { hasProProfile, loadHomeData, type HomeData } from '@/lib/firebase/home-data';
import { formatPrice } from '@/lib/format';
import { bookPrices } from '@/lib/offer';
import {
  buildHomeRows,
  HOME_CHANNELS,
  parseRemembered,
  pickHomeLine,
  type HomeChannel,
} from '@/lib/home-state';
import { saveReuseCharacter } from '@/lib/reuse-character';

import { LineCards } from './line-cards';
import { NextCard, nextFor } from './next-card';
import { ProjectList } from './project-list';
import type { LineCopy } from './parts';

/** Datos de prueba para /dev-home: lo de la cuenta más las pistas que la home lee aparte. */
export type HomePreview = HomeData & { remembered?: HomeChannel | null; name?: string | null };

/** La línea por la que entró la visita (RememberChannel); solo en el navegador. */
function readRemembered(): HomeChannel | null {
  try {
    return parseRemembered(window.sessionStorage.getItem(CHANNEL_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Home de quien ya tiene sesión, la misma para las tres líneas: el saludo, «Lo próximo» (lo que
 * pide una acción, con el único botón durazno), «Crear algo nuevo» con las tres líneas y «Tus
 * proyectos» de todas las líneas. Qué línea manda lo decide `pickHomeLine`. En modo Pro la lista
 * de proyectos por niño va arriba. Mientras carga muestra un esqueleto (nunca la landing).
 */
export function SignedInHome({
  stories,
  offer,
  country,
  christmas,
  lines,
  previewData,
}: {
  stories: PublicStory[];
  offer: Offer | null;
  country: CountryCode;
  /** Línea de Navidad (la arma el servidor: depende del país y de la fecha). */
  christmas: ReactNode;
  /** Nombre y frase de cada línea, de la landing. */
  lines: LineCopy;
  /** Datos de prueba para la página de capturas (no pasa por la sesión ni por Firestore). */
  previewData?: HomePreview;
}) {
  const t = useTranslations('HomeSession');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { user, signedIn, loading } = useAuth();
  const [loaded, setLoaded] = useState<HomePreview | null>(previewData ?? null);

  useEffect(() => {
    if (previewData) return;
    if (!loading && !signedIn) router.refresh();
  }, [loading, signedIn, router, previewData]);

  useEffect(() => {
    if (previewData || !user || !signedIn) return;
    let cancelled = false;
    void getFirebaseDb()
      .then((db) => loadHomeData(db, user.uid))
      .catch(() => ({ books: [], orders: [], projects: [], pro: null }))
      .then((result) => {
        if (!cancelled) setLoaded({ ...result, remembered: readRemembered() });
      });
    return () => {
      cancelled = true;
    };
  }, [user, signedIn, previewData]);

  const view = useMemo(
    () =>
      loaded
        ? pickHomeLine(loaded.books, loaded.orders, {
            proProfile: hasProProfile(loaded.pro),
            remembered: loaded.remembered ?? null,
          })
        : null,
    [loaded],
  );
  const rows = useMemo(
    () => (loaded ? buildHomeRows(loaded.books, loaded.orders, loaded.projects) : []),
    [loaded],
  );

  if (!loaded || !view) {
    return (
      <div
        className="container-page grid gap-8 py-8 font-sans lg:py-12"
        role="status"
        aria-label={t('loading')}
      >
        <div className="grid gap-3">
          <div className="h-7 w-32 rounded-lg bg-border" />
          <div className="h-10 w-3/4 max-w-md rounded-xl bg-border" />
        </div>
        <div className="h-36 rounded-[1.375rem] bg-border/60" />
        <div className="grid gap-3 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-28 rounded-2xl bg-border/60 lg:h-64" />
          ))}
        </div>
      </div>
    );
  }

  const fullName = previewData?.name !== undefined ? previewData.name : user?.displayName;
  const name = fullName?.trim() ? (fullName.trim().split(/\s+/)[0] ?? null) : null;
  const next = view.next;
  // El libro ya está elegido: su precio exacto (el de su extensión), el mismo del pago.
  const nextLength = next && next.kind !== 'order' ? next.book.length : null;
  const digitalMinor = offer && nextLength ? bookPrices(offer, nextLength).digital : null;
  const digitalPrice =
    digitalMinor != null
      ? formatPrice(digitalMinor, offer?.currency ?? 'USD', locale, country)
      : null;

  const model = next ? nextFor(next, t, locale, digitalPrice) : null;
  // En modo Pro sin proyectos todavía no hay lista (ni su botón): la línea Pro se destaca abajo.
  const showList = rows.length > 0;
  const proList = view.pro && showList;
  const lead: HomeChannel | null = next || proList ? null : view.line;
  // Con un kit de cumpleaños en curso, Familias ofrece el libro del cumpleañero.
  const birthday = loaded.books.some((book) => book.channel === 'events');
  // Ya compró un cuento de Familias: el próximo arranca con el mismo personaje (como antes).
  const lastFamily = loaded.orders
    .filter((order) => order.channel === 'families' && order.childId)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  const reuse =
    !next && lastFamily?.childId
      ? () => {
          if (lastFamily.childId) saveReuseCharacter(lastFamily.childId);
        }
      : undefined;

  const heading = proList ? t('titlePro') : next ? t('titleResume') : t('titleNew');
  const cards = (
    <LineCards
      // Orden fijo (Familias, Celebraciones, Profesionales); la línea que manda solo se destaca.
      order={[...HOME_CHANNELS]}
      lead={lead}
      lines={lines}
      birthday={birthday}
      onFamilies={reuse}
    />
  );
  const list = showList ? (
    <ProjectList
      rows={rows}
      lines={lines}
      stories={stories}
      pro={view.pro}
      proStatus={loaded.pro}
      uid={user?.uid ?? null}
    />
  ) : null;

  return (
    <div className="container-page grid gap-9 pt-6 pb-14 font-sans sm:gap-11 lg:pt-10">
      <header className="grid gap-1">
        {name && (
          <p className="font-script text-[1.65rem] leading-none text-primary">
            {t('hello', { name })}
          </p>
        )}
        <h1 className="text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.1] font-bold tracking-[-0.01em] text-balance">
          {heading}
        </h1>
      </header>

      {next && model && (
        <NextCard
          next={next}
          model={model}
          lines={lines}
          stories={stories}
          label={t('nextLabel')}
          christmas={christmas}
        />
      )}

      {proList ? (
        <>
          {list}
          {cards}
        </>
      ) : (
        <>
          {cards}
          {list}
        </>
      )}

      {/* Confianza: una línea, no una sección. */}
      <ul className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-5 text-[0.92rem] text-muted-foreground">
        {(['preview', 'photos', 'noPhotos'] as const).map((key) => (
          <li key={key} className="inline-flex items-center gap-2">
            <Check className="size-[18px] shrink-0 text-success" aria-hidden="true" />
            {t(`trust.${key}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}
