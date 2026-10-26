'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { getFirebaseDb } from '@/lib/firebase/client';
import { updateBook } from '@/lib/firebase/drafts';

import { OptionCard } from './option-card';
import type { StepNav, WizardData } from './types';
import { WizardShell } from './wizard-shell';

export function StepStory({ nav, data }: { nav: StepNav; data: WizardData }) {
  const t = useTranslations('Wizard.story');
  const tStories = useTranslations('Stories');
  const [selected, setSelected] = useState(data.book.storyId);
  const [error, setError] = useState<string | null>(null);
  const age = data.child?.age;

  const fits = (min: number, max: number) => age !== undefined && min <= age && age <= max;
  const ordered = data.stories.toSorted(
    (a, b) => Number(fits(b.ageMin, b.ageMax)) - Number(fits(a.ageMin, a.ageMax)),
  );

  async function next() {
    if (!selected) {
      setError(t('required'));
      return;
    }
    const ok = await nav.save(async () => {
      await updateBook(await getFirebaseDb(), data.book.id, { storyId: selected });
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
              <Image
                src={story.coverImage}
                alt=""
                width={300}
                height={400}
                unoptimized
                className="aspect-[3/4] w-full object-cover"
              />
              <span className="grid gap-1.5 p-3">
                <span className="font-display text-lg leading-snug font-semibold">
                  {story.title}
                </span>
                <span className="text-xs font-bold text-muted-foreground">
                  {tStories('agesFor', { min: story.ageMin, max: story.ageMax })}
                </span>
                {fits(story.ageMin, story.ageMax) && (
                  <span className="w-fit rounded-full bg-mint px-2 py-0.5 text-xs font-extrabold text-success">
                    {t('recommended')}
                  </span>
                )}
              </span>
            </OptionCard>
          ))}
        </div>
      </fieldset>
    </WizardShell>
  );
}
