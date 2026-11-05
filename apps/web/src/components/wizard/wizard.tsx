'use client';

import type { Locale } from '@storynido/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { getFirebaseDb } from '@/lib/firebase/client';
import { titleForChild } from '@/lib/story-title';
import type { WizardCatalog } from '@/lib/server/wizard-catalog';
import { useRouter } from '@/i18n/navigation';
import {
  createDraft,
  subscribeBook,
  subscribeChild,
  unsavedDraft,
  updateBook,
  type ChildFields,
  type DraftPreset,
} from '@/lib/firebase/drafts';

import { previewErrorKey } from './preview-errors';
import { PreviewPanel } from './preview-panel';
import { SignInGate } from './sign-in-gate';
import { WizardSkeleton } from './wizard-skeleton';
import { StepChild } from './step-child';
import { StepFocus } from './step-focus';
import { StepReading } from './step-reading';
import { StepKit } from './step-kit';
import { StepParty } from './step-party';
import { StepAvatar } from './step-avatar';
import { StepLesson } from './step-lesson';
import { StepMemories } from './step-memories';
import { StepDrawing } from './step-drawing';
import { StepPhotos } from './step-photos';
import { StepReview } from './step-review';
import { StepStory } from './step-story';
import { StepStyle } from './step-style';
import { WIZARD_STEPS, flowFor, reachedIndex, type SaveState, type WizardStep } from './steps';
import type { StepNav, WizardData } from './types';

type Catalog = WizardCatalog;

/**
 * Creador del libro: borrador en Firestore, guardado en cada paso, se retoma donde quedó. Sin
 * `bookId` arranca con un borrador en memoria y lo crea en el primer guardado real.
 */
export function Wizard({
  bookId: savedId,
  preset,
  catalog,
}: {
  bookId: string | null;
  /** Borrador nuevo (sin `bookId`): línea, idioma e historia elegida. */
  preset?: DraftPreset;
  catalog: Catalog;
}) {
  const t = useTranslations('Wizard');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { user, loading } = useAuth();
  const [book, setBook] = useState<WizardData['book'] | null | undefined>(() =>
    savedId === null && user && preset ? unsavedDraft(user.uid, preset) : undefined,
  );
  // Id del borrador creado en esta visita (primer guardado de un borrador en memoria).
  const createdId = useRef<string | null>(null);
  const bookId = savedId ?? '';
  const [child, setChild] = useState<ChildFields | null>(null);
  const [current, setCurrent] = useState<WizardStep | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  // La muestra se abre sola si el libro ya tiene una (o se está generando).
  const [view, setView] = useState<'steps' | 'preview' | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Borrador en memoria: se arma cuando hay sesión (todavía no existe en Firestore).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedId === null && user && preset && !book) setBook(unsavedDraft(user.uid, preset));
  }, [savedId, user, preset, book]);

  useEffect(() => {
    if (!user || savedId === null) return;
    let unsubscribe: (() => void) | undefined;
    const effect = { cancelled: false };
    void getFirebaseDb().then((db) => {
      if (effect.cancelled) return;
      unsubscribe = subscribeBook(db, bookId, setBook, () => {
        setBook(null);
      });
    });
    return () => {
      effect.cancelled = true;
      unsubscribe?.();
    };
  }, [user, savedId, bookId]);

  const childId = book?.childId ?? null;
  useEffect(() => {
    if (!childId) return;
    let unsubscribe: (() => void) | undefined;
    const effect = { cancelled: false };
    void getFirebaseDb().then((db) => {
      if (!effect.cancelled) unsubscribe = subscribeChild(db, childId, setChild);
    });
    return () => {
      effect.cancelled = true;
      unsubscribe?.();
    };
  }, [childId]);

  const channel = book?.channel ?? 'families';
  const flow = flowFor(channel);
  // Al abrir el borrador se retoma en el último paso alcanzado (con migración del índice viejo).
  if (book && current === null) setCurrent(flow[reachedIndex(flow, book)] ?? 'child');
  if (book && view === null) setView(book.status === 'draft' ? 'steps' : 'preview');

  const generatePreview = useCallback(async () => {
    setView('preview');
    setGenerating(true);
    setGenerateError(null);
    // Sin el viaje animado (el html tiene scroll suave para las anclas de la landing).
    window.scrollTo({ top: 0, behavior: 'instant' });
    try {
      await api('generatePreview', { params: { bookId } });
    } catch (error) {
      setGenerateError(previewErrorKey(error));
    } finally {
      setGenerating(false);
    }
  }, [bookId]);

  const save = useCallback(async (action: () => Promise<void>) => {
    setSaveState('saving');
    try {
      await action();
      setSaveState('saved');
      return true;
    } catch {
      setSaveState('error');
      return false;
    }
  }, []);

  const step = current ?? 'child';
  const index = Math.max(flow.indexOf(step), 0);
  const reached = book ? Math.max(reachedIndex(flow, book), index) : index;

  /** Id del borrador; si todavía está en memoria, lo crea (primer guardado real). */
  const ensureBook = useCallback(async () => {
    if (savedId) return savedId;
    if (createdId.current) return createdId.current;
    if (!user || !preset) throw new Error('Sin sesión');
    createdId.current = await createDraft(await getFirebaseDb(), user.uid, preset);
    return createdId.current;
  }, [savedId, user, preset]);

  const nav = useMemo<StepNav>(
    () => ({
      step,
      flow,
      reached,
      line: channel,
      fresh: savedId === null,
      choice: {
        // Celebraciones no elige historia: la temática la trae, y se cambia en la etapa Aventura.
        story: (() => {
          if (channel === 'events') return null;
          const picked = catalog.stories.find((item) => item.slug === book?.storyId);
          return picked ? titleForChild(picked, child?.name, locale) : null;
        })(),
        lesson: catalog.lessons.find((item) => book?.lessonIds.includes(item.slug))?.name ?? null,
      },
      saveState,
      save,
      ensureBook,
      onBack:
        index > 0
          ? () => {
              setCurrent(flow[index - 1] ?? 'child');
              window.scrollTo({ top: 0, behavior: 'instant' });
            }
          : undefined,
      onJump: (target) => {
        if (flow.indexOf(target) > reached) return;
        setCurrent(target);
        window.scrollTo({ top: 0, behavior: 'instant' });
      },
      goNext: async () => {
        const next = flow[Math.min(index + 1, flow.length - 1)] ?? 'review';
        if (flow.indexOf(next) > (book ? reachedIndex(flow, book) : 0)) {
          await save(async () => {
            // El paso se guarda por nombre; el índice viejo queda para los borradores anteriores.
            await updateBook(await getFirebaseDb(), await ensureBook(), {
              wizardStepKey: next,
              wizardStep: WIZARD_STEPS.indexOf(next),
            });
          });
        }
        // Recién creado: la URL pasa a la del borrador (y desde ahí se sigue en vivo).
        if (savedId === null && createdId.current) {
          router.replace({ pathname: '/create/[bookId]', params: { bookId: createdId.current } });
          return;
        }
        setCurrent(next);
        // Sin el viaje animado (el html tiene scroll suave para las anclas de la landing).
        window.scrollTo({ top: 0, behavior: 'instant' });
      },
    }),
    [
      step,
      flow,
      index,
      reached,
      channel,
      saveState,
      save,
      ensureBook,
      book,
      savedId,
      router,
      catalog,
      child,
      locale,
    ],
  );

  if (!loading && !user) return <SignInGate />;
  if (book === null) {
    return (
      <p className="container-page py-20 text-center text-muted-foreground">{t('notFound')}</p>
    );
  }
  if (loading || !book || (book.childId && !child)) {
    return <WizardSkeleton />;
  }

  const data: WizardData = { book, child, ...catalog };
  if (view === 'preview') {
    return (
      <PreviewPanel
        book={book}
        childName={child?.name ?? ''}
        prices={catalog.prices}
        eventPrices={catalog.eventPrices}
        familyBookPages={catalog.editorial.lengths[catalog.editorial.defaults.length].interiorPages}
        generating={generating}
        generateError={generateError}
        onRegenerateAll={() => void generatePreview()}
        onEditChoices={() => {
          setView('steps');
          setCurrent('review');
          // Sin el viaje animado (el html tiene scroll suave para las anclas de la landing).
          window.scrollTo({ top: 0, behavior: 'instant' });
        }}
      />
    );
  }
  // Cada paso se monta de nuevo al cambiar (estado del formulario fresco).
  switch (step) {
    case 'child':
      return <StepChild key="child" nav={nav} data={data} />;
    case 'photos':
      // Con su dibujo aprobado en el perfil: se usa ese (sin fotos ni rasgos que elegir).
      return book.useDrawing === true && book.childId ? (
        <StepDrawing key="drawing" nav={nav} data={data} />
      ) : book.characterMode === 'avatar' ? (
        <StepAvatar key="avatar" nav={nav} data={data} />
      ) : (
        <StepPhotos key="photos" nav={nav} data={data} />
      );
    case 'memories':
      return <StepMemories key="memories" nav={nav} data={data} />;
    case 'story':
      return <StepStory key="story" nav={nav} data={data} />;
    case 'lesson':
      return <StepLesson key="lesson" nav={nav} data={data} />;
    case 'party':
      return <StepParty key="party" nav={nav} data={data} />;
    case 'kit':
      return <StepKit key="kit" nav={nav} data={data} />;
    case 'focus':
      return <StepFocus key="focus" nav={nav} data={data} />;
    case 'reading':
      return <StepReading key="reading" nav={nav} data={data} />;
    case 'style':
      return <StepStyle key="style" nav={nav} data={data} />;
    default:
      return (
        <StepReview
          key="review"
          nav={nav}
          data={data}
          onGenerate={() => void generatePreview()}
          onViewPreview={
            book.preview
              ? () => {
                  setView('preview');
                }
              : undefined
          }
        />
      );
  }
}
