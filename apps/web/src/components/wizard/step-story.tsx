'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { LOCALES, suggestedReading, type Locale, type PublicStory } from '@storynido/shared';

import { StoryCover } from '@/components/stories/story-cover';
import { getFirebaseDb } from '@/lib/firebase/client';
import { updateBook } from '@/lib/firebase/drafts';
import { titleForChild } from '@/lib/story-title';

import { BookOptions, type BookChoice } from './book-options';
import { OptionCard } from './option-card';
import type { StepNav, WizardData } from './types';
import { WizardShell } from './wizard-shell';

/** Cada idioma en su propio idioma, para que se reconozca sin importar el del sitio. */
const LANGUAGE_NAMES: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
};

export function StepStory({ nav, data }: { nav: StepNav; data: WizardData }) {
  const t = useTranslations('Wizard.story');
  const tStories = useTranslations('Stories');
  const locale = useLocale() as Locale;
  const [selected, setSelected] = useState(data.book.storyId);
  const [error, setError] = useState<string | null>(null);
  // Idioma del cuento: arranca con el del sitio, pero se puede elegir otro (familias bilingües o de otro país).
  const [language, setLanguage] = useState<Locale>(data.book.language);
  const age = data.child?.age;
  // La primera vez que se llega a este paso, la lectura se sugiere según la edad.
  const firstVisit = nav.reached <= nav.flow.indexOf('story');
  const [choice, setChoice] = useState<BookChoice>(() => ({
    contentType: data.book.contentType,
    ...(firstVisit && age !== undefined
      ? {
          ...suggestedReading(age),
          // Celebraciones arranca como mini cuento para cada invitado, sea cual sea la edad.
          ...(data.book.channel === 'events' && data.book.length
            ? { length: data.book.length }
            : {}),
        }
      : {
          length: data.book.length ?? data.editorial.defaults.length,
          textDensity: data.book.textDensity,
          readingLevel: data.book.readingLevel,
        }),
  }));
  const story = data.stories.find((item) => item.slug === selected);

  const fits = (min: number, max: number) => age !== undefined && min <= age && age <= max;
  // Solo las historias de la línea del libro, no las de otra línea que también la incluyen
  // (Profesionales sí ve las que lo incluyen). Si no hubiera ninguna, todas.
  const channel = data.book.channel;
  const forChannel = data.stories.filter((item) =>
    channel === 'professionals' ? item.channels.includes(channel) : item.channels[0] === channel,
  );
  // Con una enseñanza elegida, las historias que la sugieren van primero («Ideal para…»).
  const lesson = data.lessons.find((item) => data.book.lessonIds.includes(item.slug));
  const forLesson = (story: PublicStory) =>
    lesson !== undefined && (story.suggestedLessons?.includes(lesson.slug) ?? false);
  const ordered = (forChannel.length > 0 ? forChannel : data.stories).toSorted(
    (a, b) =>
      Number(forLesson(b)) - Number(forLesson(a)) ||
      Number(fits(b.ageMin, b.ageMax)) - Number(fits(a.ageMin, a.ageMax)),
  );

  async function next() {
    if (!selected) {
      setError(t('required'));
      return;
    }
    const options = fitToStory(choice, story);
    const ok = await nav.save(async () => {
      await updateBook(await getFirebaseDb(), await nav.ensureBook(), {
        storyId: selected,
        language,
        ...options,
      });
    });
    if (ok) await nav.goNext();
  }

  return (
    <WizardShell
      {...nav}
      title={t('title')}
      subtitle={t('subtitle')}
      error={error}
      onNext={() => void next()}
    >
      <fieldset>
        <legend className="sr-only">{t('title')}</legend>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {ordered.map((story) => (
            <OptionCard
              key={story.slug}
              name="story"
              value={story.slug}
              checked={selected === story.slug}
              onSelect={(value) => {
                setSelected(value);
                setError(null);
              }}
            >
              <div className="aspect-[3/4] w-full overflow-hidden">
                <StoryCover story={story} sizes="(min-width: 768px) 20vw, 45vw" />
              </div>
              <span className="grid gap-1.5 p-3">
                <span className="font-display text-lg leading-snug font-semibold">
                  {titleForChild(story, data.child?.name, locale)}
                </span>
                <span className="text-xs font-bold text-muted-foreground">
                  {tStories('agesFor', { min: story.ageMin, max: story.ageMax })}
                </span>
                {lesson && forLesson(story) ? (
                  <span className="w-fit rounded-full bg-mint px-2 py-0.5 text-xs font-semibold text-success">
                    {t('idealFor', { name: lesson.name })}
                  </span>
                ) : (
                  fits(story.ageMin, story.ageMax) && (
                    <span className="w-fit rounded-full bg-mint px-2 py-0.5 text-xs font-semibold text-success">
                      {t('recommended')}
                    </span>
                  )
                )}
              </span>
            </OptionCard>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-8">
        <legend className="font-display text-xl font-semibold">{t('languageTitle')}</legend>
        <p className="mt-1 text-sm text-muted-foreground">{t('languageHint')}</p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {LOCALES.map((code) => (
            <OptionCard
              key={code}
              name="book-language"
              value={code}
              checked={language === code}
              onSelect={() => {
                setLanguage(code);
              }}
            >
              <span className="p-3 text-center font-semibold">{LANGUAGE_NAMES[code]}</span>
            </OptionCard>
          ))}
        </div>
      </fieldset>

      <BookOptions
        story={story}
        editorial={data.editorial}
        prices={data.book.channel === 'events' ? null : data.prices}
        age={age ?? null}
        value={fitToStory(choice, story)}
        onChange={setChoice}
        formats={data.book.channel !== 'events'}
      />
    </WizardShell>
  );
}

/** Si la historia no admite alguna opción elegida, se usa la primera que sí admite. */
function fitToStory(choice: BookChoice, story: PublicStory | undefined): BookChoice {
  if (!story) return choice;
  const pick = <T,>(value: T, allowed: readonly T[]) =>
    allowed.includes(value) ? value : (allowed[0] ?? value);
  return {
    length: pick(choice.length, story.lengths),
    textDensity: pick(choice.textDensity, story.textDensities),
    readingLevel: pick(choice.readingLevel, story.readingLevels),
    contentType: pick(choice.contentType, story.contentTypes),
  };
}
