'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { CHILD_LIMITS, LESSON_GROUPS } from '@storynido/shared';

import { getFirebaseDb } from '@/lib/firebase/client';
import { updateBook } from '@/lib/firebase/drafts';

import type { StepNav, WizardData } from './types';
import { WizardShell } from './wizard-shell';

const chipClass =
  'flex cursor-pointer items-center rounded-full border-2 px-4 py-2 text-sm font-bold transition has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:checked]:text-primary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-45 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50';

/** Hasta 2 enseñanzas; el mensaje propio cuenta como una. */
export function StepLesson({ nav, data }: { nav: StepNav; data: WizardData }) {
  const t = useTranslations('Wizard.lesson');
  const tGroups = useTranslations('Lessons.groups');
  const { book } = data;
  const [selected, setSelected] = useState<string[]>(book.lessonIds);
  const [useCustom, setUseCustom] = useState(Boolean(book.customLesson));
  const [custom, setCustom] = useState(book.customLesson ?? '');
  // Profesionales: objetivo general; los de la historia si los tiene, o los temas de sus colecciones.
  const [goal, setGoal] = useState<string | null>(book.goal ?? null);
  const story = data.stories.find((item) => item.slug === book.storyId);
  const goals =
    book.channel === 'professionals' && story?.objectives?.length
      ? story.objectives
      : book.channel === 'professionals' && story
        ? [
            ...new Set(
              data.collections
                .filter((collection) => story.collectionIds.includes(collection.slug))
                .flatMap((collection) => collection.topics),
            ),
          ]
        : [];
  const age = data.child?.age;
  const lessons = data.lessons.filter(
    (lesson) => age === undefined || (lesson.ageMin <= age && age <= lesson.ageMax),
  );

  const suggested = story?.suggestedLessons ?? [];

  const count = selected.length + (useCustom ? 1 : 0);
  const full = count >= CHILD_LIMITS.maxLessons;

  function toggle(slug: string) {
    setSelected((current) =>
      current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug],
    );
  }

  async function next() {
    const ok = await nav.save(async () => {
      await updateBook(await getFirebaseDb(), book.id, {
        lessonIds: selected,
        customLesson: useCustom && custom.trim() ? custom.trim() : null,
        ...(goals.length > 0 ? { goal: goal && goals.includes(goal) ? goal : null } : {}),
      });
    });
    if (ok) await nav.goNext();
  }

  const checkbox = (key: string, label: string, checked: boolean, onChange: () => void) => (
    <label key={key} className={chipClass}>
      <input
        type="checkbox"
        checked={checked}
        disabled={!checked && full}
        onChange={onChange}
        className="sr-only"
      />
      {label}
    </label>
  );

  return (
    <WizardShell {...nav} title={t('title')} subtitle={t('subtitle')} onNext={() => void next()}>
      <p className="-mt-4 mb-6 text-sm font-bold text-primary" aria-live="polite">
        {t('pickUpTo', { max: CHILD_LIMITS.maxLessons, count })}
      </p>
      {goals.length > 0 && (
        <fieldset className="mb-8 grid gap-3 rounded-2xl border bg-card p-4">
          <legend className="px-1 text-base font-semibold">{t('goal.title')}</legend>
          <p className="text-sm text-muted-foreground">{t('goal.hint')}</p>
          <div className="flex flex-wrap gap-2">
            {[null, ...goals].map((option) => (
              <label key={option ?? 'none'} className={chipClass}>
                <input
                  type="radio"
                  name="goal"
                  className="sr-only"
                  checked={goal === option}
                  onChange={() => {
                    setGoal(option);
                  }}
                />
                {option ?? t('goal.none')}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset className="grid gap-6">
        <legend className="sr-only">{t('title')}</legend>
        {(['suggested', ...LESSON_GROUPS] as const).map((group) => {
          // Primero las que encajan con el argumento; después, el resto por grupo.
          const items =
            group === 'suggested'
              ? suggested.flatMap((slug) => lessons.filter((lesson) => lesson.slug === slug))
              : lessons.filter(
                  (lesson) => lesson.group === group && !suggested.includes(lesson.slug),
                );
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <p className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
                {tGroups(group)}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {items.map((lesson) =>
                  checkbox(lesson.slug, lesson.name, selected.includes(lesson.slug), () => {
                    toggle(lesson.slug);
                  }),
                )}
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2 border-t pt-6">
          {checkbox('custom', t('custom'), useCustom, () => {
            setUseCustom(!useCustom);
          })}
          {count > 0 && (
            <button
              type="button"
              className="rounded-full px-4 py-2 text-sm font-bold text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => {
                setSelected([]);
                setUseCustom(false);
              }}
            >
              {t('clear')}
            </button>
          )}
        </div>
        {useCustom && (
          <div className="grid gap-2">
            <label htmlFor="custom-lesson" className="text-[0.91rem] font-semibold">
              {t('customLabel')}
            </label>
            <textarea
              id="custom-lesson"
              value={custom}
              maxLength={CHILD_LIMITS.customLessonMaxLength}
              placeholder={t('customPlaceholder')}
              aria-describedby="custom-lesson-hint"
              onChange={(event) => {
                setCustom(event.target.value);
              }}
              className="h-24 w-full rounded-[0.75rem] border-[1.5px] border-[#b7bcc8] bg-card px-3.5 py-3 text-base focus:border-primary focus:outline-3 focus:outline-offset-1 focus:outline-[#d9cef0]"
            />
            <p id="custom-lesson-hint" className="text-sm text-muted-foreground">
              {t('customHint', { count: custom.length })}
            </p>
          </div>
        )}
      </fieldset>
    </WizardShell>
  );
}
