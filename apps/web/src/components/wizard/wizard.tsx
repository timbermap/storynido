'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { getFirebaseDb } from '@/lib/firebase/client';
import { subscribeBook, subscribeChild, updateBook, type ChildFields } from '@/lib/firebase/drafts';

import { SignInGate } from './sign-in-gate';
import { StepChild } from './step-child';
import { StepLesson } from './step-lesson';
import { StepPhotos } from './step-photos';
import { StepReview } from './step-review';
import { StepStory } from './step-story';
import { StepStyle } from './step-style';
import { WIZARD_STEPS, type SaveState } from './steps';
import type { StepNav, WizardData } from './types';

type Catalog = Pick<WizardData, 'stories' | 'lessons' | 'styles'>;

/** Creador del libro: borrador en Firestore, guardado en cada paso, se retoma donde quedó. */
export function Wizard({ bookId, catalog }: { bookId: string; catalog: Catalog }) {
  const t = useTranslations('Wizard');
  const { user, loading } = useAuth();
  const [book, setBook] = useState<WizardData['book'] | null | undefined>(undefined);
  const [child, setChild] = useState<ChildFields | null>(null);
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  useEffect(() => {
    if (!user) return;
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
  }, [user, bookId]);

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

  // Al abrir el borrador se retoma en el último paso alcanzado.
  if (book && stepIndex === null) setStepIndex(Math.min(book.wizardStep, WIZARD_STEPS.length - 1));

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

  const current = stepIndex ?? 0;
  const maxReached = Math.max(book?.wizardStep ?? 0, current);

  const nav = useMemo<StepNav>(
    () => ({
      stepIndex: current,
      maxReached,
      saveState,
      save,
      onBack:
        current > 0
          ? () => {
              setStepIndex(current - 1);
            }
          : undefined,
      onJump: (index) => {
        if (index <= maxReached) setStepIndex(index);
      },
      goNext: async () => {
        const nextIndex = Math.min(current + 1, WIZARD_STEPS.length - 1);
        if (nextIndex > (book?.wizardStep ?? 0)) {
          await save(async () => {
            await updateBook(await getFirebaseDb(), bookId, { wizardStep: nextIndex });
          });
        }
        setStepIndex(nextIndex);
        window.scrollTo({ top: 0 });
      },
    }),
    [current, maxReached, saveState, save, book?.wizardStep, bookId],
  );

  if (!loading && !user) return <SignInGate />;
  if (book === null) {
    return (
      <p className="container-page py-20 text-center text-muted-foreground">{t('notFound')}</p>
    );
  }
  if (loading || !book || (book.childId && !child)) {
    return (
      <p role="status" className="container-page py-20 text-center text-muted-foreground">
        {t('loading')}
      </p>
    );
  }

  const data: WizardData = { book, child, ...catalog };
  // Cada paso se monta de nuevo al cambiar (estado del formulario fresco).
  switch (WIZARD_STEPS[current]) {
    case 'child':
      return <StepChild key="child" nav={nav} data={data} />;
    case 'photos':
      return <StepPhotos key="photos" nav={nav} data={data} />;
    case 'story':
      return <StepStory key="story" nav={nav} data={data} />;
    case 'lesson':
      return <StepLesson key="lesson" nav={nav} data={data} />;
    case 'style':
      return <StepStyle key="style" nav={nav} data={data} />;
    default:
      return <StepReview key="review" nav={nav} data={data} />;
  }
}
