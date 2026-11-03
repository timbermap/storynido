'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import type { Locale } from '@storynido/shared';

import { StoryCover } from '@/components/stories/story-cover';
import { getFirebaseDb } from '@/lib/firebase/client';
import { updateBook } from '@/lib/firebase/drafts';
import { titleForChild } from '@/lib/story-title';

import { OptionCard } from './option-card';
import { miniBookOptions, styleForStory } from './party';
import { baseStories, collectionOfDraft } from './pro';
import { fitToStory } from './step-story';
import type { StepNav, WizardData } from './types';
import { WizardShell } from './wizard-shell';

const chipClass =
  'flex cursor-pointer items-center rounded-full border-2 px-4 py-2 text-sm font-bold transition has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-white has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50';

/** Profesionales, etapa Aventura: se parte de la situación: colección, objetivo y cuento base. */
export function StepFocus({ nav, data }: { nav: StepNav; data: WizardData }) {
  const t = useTranslations('Wizard.focus');
  const tStories = useTranslations('Stories');
  const locale = useLocale() as Locale;
  const { book, child } = data;
  const age = child?.age;
  const draftStory = data.stories.find((item) => item.slug === book.storyId);
  const [collectionSlug, setCollectionSlug] = useState(
    collectionOfDraft(data.collections, draftStory, book.goal)?.slug ?? null,
  );
  const collection = data.collections.find((item) => item.slug === collectionSlug);
  const [goal, setGoal] = useState(
    book.goal && collection?.topics.includes(book.goal) ? book.goal : null,
  );
  const [storyId, setStoryId] = useState(collection ? (book.storyId ?? null) : null);
  const [error, setError] = useState<string | null>(null);
  const stories = collection ? baseStories(data.stories, collection.slug, age) : [];
  const fits = (min: number, max: number) => age !== undefined && min <= age && age <= max;

  async function next() {
    const story = stories.find((item) => item.slug === storyId);
    if (!collection) {
      setError(t('requiredCollection'));
      return;
    }
    if (!goal) {
      setError(t('requiredGoal'));
      return;
    }
    const styleId = story && (book.styleId ?? styleForStory(story, data.styles, book.contentType));
    if (!story || !styleId) {
      setError(t('requiredStory'));
      return;
    }
    const ok = await nav.save(async () => {
      await updateBook(await getFirebaseDb(), await nav.ensureBook(), {
        storyId: story.slug,
        goal,
        styleId,
        ...fitToStory(
          {
            contentType: book.contentType,
            length: book.length ?? data.editorial.defaults.length,
            textDensity: book.textDensity,
            readingLevel: book.readingLevel,
            // Sin estilo es la primera vez: arranca en Mini, con la lectura según la edad.
            // «Repetir configuración» ya trae estilo y conserva lo que copió.
            ...(book.styleId === null ? miniBookOptions(age) : {}),
          },
          story,
        ),
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
      <div className="grid gap-8">
        <fieldset>
          <legend className="mb-3 font-display text-xl font-semibold">{t('collection')}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.collections.map((item) => (
              <OptionCard
                key={item.slug}
                name="pro-collection"
                value={item.slug}
                checked={collectionSlug === item.slug}
                onSelect={(value) => {
                  if (value === collectionSlug) return;
                  setCollectionSlug(value);
                  setGoal(null);
                  setStoryId(null);
                  setError(null);
                }}
              >
                <span className="grid gap-1 p-4 pr-12">
                  <span className="font-display text-lg leading-snug font-semibold">
                    {item.name}
                  </span>
                  <span className="text-sm leading-snug text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </OptionCard>
            ))}
          </div>
        </fieldset>

        {collection && (
          <fieldset>
            <legend className="font-display text-xl font-semibold">{t('goal')}</legend>
            <p className="mt-1 mb-3 text-sm text-muted-foreground">{t('goalHint')}</p>
            <div className="flex flex-wrap gap-2">
              {collection.topics.map((topic) => (
                <label key={topic} className={chipClass}>
                  <input
                    type="radio"
                    name="pro-goal"
                    className="sr-only"
                    checked={goal === topic}
                    onChange={() => {
                      setGoal(topic);
                      setError(null);
                    }}
                  />
                  {topic}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {collection && (
          <fieldset>
            <legend className="mb-3 font-display text-xl font-semibold">{t('story')}</legend>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {stories.map((story) => (
                <OptionCard
                  key={story.slug}
                  name="pro-story"
                  value={story.slug}
                  checked={storyId === story.slug}
                  onSelect={(value) => {
                    setStoryId(value);
                    setError(null);
                  }}
                >
                  <div className="aspect-[3/4] w-full overflow-hidden">
                    <StoryCover story={story} sizes="(min-width: 768px) 20vw, 45vw" />
                  </div>
                  <span className="grid gap-1.5 p-3">
                    <span className="font-display text-lg leading-snug font-semibold">
                      {titleForChild(story, child?.name, locale)}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground">
                      {tStories('agesFor', { min: story.ageMin, max: story.ageMax })}
                    </span>
                    {fits(story.ageMin, story.ageMax) && (
                      <span className="w-fit rounded-full bg-mint px-2 py-0.5 text-xs font-semibold text-success">
                        {t('recommended')}
                      </span>
                    )}
                  </span>
                </OptionCard>
              ))}
            </div>
          </fieldset>
        )}
      </div>
    </WizardShell>
  );
}
