'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { EVENT_LIMITS, EVENT_TYPES, turningAgeFor, type EventType } from '@storynido/shared';

import { StoryCover } from '@/components/stories/story-cover';
import { getFirebaseDb } from '@/lib/firebase/client';
import { updateBook } from '@/lib/firebase/drafts';
import { useStepDraft } from '@/lib/use-step-draft';
import type { Locale } from '@storynido/shared';

import { OptionCard } from './option-card';
import { matchTheme, partyBookOptions, storyForTheme, styleForStory } from './party';
import { inputClass, labelClass } from './step-child';
import { fitToStory } from './step-story';
import type { StepNav, WizardData } from './types';
import { WizardShell } from './wizard-shell';

/** Celebraciones, etapa Aventura: la temática (trae historia y estilo), la ocasión, la fecha y el lugar. */
export function StepParty({ nav, data }: { nav: StepNav; data: WizardData }) {
  const t = useTranslations('Wizard.party');
  const tOccasions = useTranslations('Wizard.child.event.occasions');
  const locale = useLocale() as Locale;
  const { book, child } = data;
  const age = child?.age;
  const [themeSlug, setThemeSlug] = useState(
    matchTheme(data.eventThemes, book.event?.theme)?.slug ?? null,
  );
  const [occasion, setOccasion] = useState<EventType>(book.event?.type ?? 'birthday');
  const [date, setDate] = useState(book.event?.date ?? '');
  const [place, setPlace] = useState(book.event?.place ?? '');
  const [error, setError] = useState<string | null>(null);
  const clearDraft = useStepDraft(
    book.id,
    'party',
    { themeSlug, occasion, date, place },
    (saved) => {
      setThemeSlug(saved.themeSlug);
      setOccasion(saved.occasion);
      setDate(saved.date);
      setPlace(saved.place);
    },
  );

  async function next() {
    const theme = data.eventThemes.find((item) => item.slug === themeSlug);
    const story = theme && storyForTheme(data.stories, theme.slug, age, book.storyId);
    const styleId = story && styleForStory(story, data.styles, book.contentType);
    if (!theme || !story || !styleId) {
      setError(t('required'));
      return;
    }
    const ok = await nav.save(async () => {
      await updateBook(await getFirebaseDb(), await nav.ensureBook(), {
        storyId: story.slug,
        styleId,
        // Quien cambia de temática no pierde el resto de lo que eligió.
        ...fitToStory(
          {
            contentType: book.contentType,
            textDensity: book.textDensity,
            readingLevel: book.readingLevel,
            ...partyBookOptions(age),
          },
          story,
        ),
        event: {
          type: occasion,
          date: date || null,
          turningAge: age === undefined ? null : turningAgeFor(occasion, age),
          theme: theme.name.slice(0, EVENT_LIMITS.themeMaxLength),
          place: place.trim() ? place.trim().slice(0, EVENT_LIMITS.placeMaxLength) : null,
          tone: book.event?.tone ?? 'fun',
          offer: book.event?.offer ?? 'full_kit',
          bookChoice: book.event?.bookChoice ?? 'none',
        },
      });
    });
    if (ok) {
      clearDraft();
      await nav.goNext();
    }
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
        <legend className="mb-3 font-display text-xl font-semibold">{t('themeLegend')}</legend>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {data.eventThemes.map((theme) => {
            const sample = storyForTheme(data.stories, theme.slug, age, null);
            return (
              <OptionCard
                key={theme.slug}
                name="party-theme"
                value={theme.slug}
                checked={themeSlug === theme.slug}
                onSelect={(value) => {
                  setThemeSlug(value);
                  setError(null);
                }}
              >
                {sample && (
                  <div className="aspect-[3/4] w-full overflow-hidden">
                    <StoryCover story={sample} sizes="(min-width: 768px) 20vw, 45vw" />
                  </div>
                )}
                <span className="grid gap-1.5 p-3">
                  <span className="font-display text-lg leading-snug font-semibold">
                    {theme.name}
                  </span>
                  <span className="text-sm leading-snug text-muted-foreground">
                    {theme.description}
                  </span>
                </span>
              </OptionCard>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="grid content-start gap-2">
          <label htmlFor="event-occasion" className={labelClass}>
            {t('occasion')}
          </label>
          <select
            id="event-occasion"
            className={inputClass}
            value={occasion}
            onChange={(event) => {
              setOccasion(event.target.value as EventType);
            }}
          >
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {tOccasions(type)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid content-start gap-2">
          <label htmlFor="event-date" className={labelClass}>
            {t('date')}
          </label>
          <input
            id="event-date"
            type="date"
            lang={locale}
            className={inputClass}
            value={date}
            aria-describedby="event-date-hint"
            onChange={(event) => {
              setDate(event.target.value);
            }}
          />
          <p id="event-date-hint" className="text-sm text-muted-foreground">
            {t('dateHint')}
          </p>
        </div>
        <div className="grid content-start gap-2 sm:col-span-2">
          <label htmlFor="event-place" className={labelClass}>
            {t('place')}
          </label>
          <input
            id="event-place"
            className={inputClass}
            value={place}
            maxLength={EVENT_LIMITS.placeMaxLength}
            autoComplete="off"
            placeholder={t('placePlaceholder')}
            onChange={(event) => {
              setPlace(event.target.value);
            }}
          />
        </div>
      </div>
    </WizardShell>
  );
}
