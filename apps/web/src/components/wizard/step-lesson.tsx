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
  const age = data.child?.age;
  const lessons = data.lessons.filter(
    (lesson) => age === undefined || (lesson.ageMin <= age && age <= lesson.ageMax),
  );

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
      <fieldset className="grid gap-6">
        <legend className="sr-only">{t('title')}</legend>
        {LESSON_GROUPS.map((group) => {
          const items = lessons.filter((lesson) => lesson.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <p className="text-sm font-black tracking-wide text-muted-foreground uppercase">
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
            <label htmlFor="custom-lesson" className="text-[0.91rem] font-extrabold">
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
              className="h-24 w-full rounded-[0.75rem] border-[1.5px] border-[#b9acbf] bg-card px-3.5 py-3 text-base focus:border-primary focus:outline-3 focus:outline-offset-1 focus:outline-[#d8c1f2]"
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
