'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  BOOK_LENGTHS,
  READING_LEVELS,
  TEXT_DENSITIES,
  suggestedReading,
  type BookLength,
} from '@storynido/shared';

import { getFirebaseDb } from '@/lib/firebase/client';
import { updateBook } from '@/lib/firebase/drafts';

import { Chips } from './book-options';
import type { StepNav, WizardData } from './types';
import { WizardShell } from './wizard-shell';

/** Profesionales, etapa Ajustes: extensión, cantidad de texto y nivel de lectura, cada uno por separado. */
export function StepReading({ nav, data }: { nav: StepNav; data: WizardData }) {
  const t = useTranslations('Wizard.reading');
  const tBook = useTranslations('Wizard.book');
  const { book, child, editorial } = data;
  const story = data.stories.find((item) => item.slug === book.storyId);
  const lengths = BOOK_LENGTHS.filter(
    (length) => editorial.lengths[length].active && (story?.lengths.includes(length) ?? true),
  );
  const densities = TEXT_DENSITIES.filter((value) => story?.textDensities.includes(value) ?? true);
  const levels = READING_LEVELS.filter((value) => story?.readingLevels.includes(value) ?? true);
  const [length, setLength] = useState<BookLength>(book.length ?? editorial.defaults.length);
  const [textDensity, setTextDensity] = useState(book.textDensity);
  const [readingLevel, setReadingLevel] = useState(book.readingLevel);
  const suggested = child ? suggestedReading(child.age) : null;

  async function next() {
    const ok = await nav.save(async () => {
      await updateBook(await getFirebaseDb(), await nav.ensureBook(), {
        length,
        textDensity,
        readingLevel,
      });
    });
    if (ok) await nav.goNext();
  }

  return (
    <WizardShell {...nav} title={t('title')} subtitle={t('subtitle')} onNext={() => void next()}>
      <div className="grid gap-8">
        {suggested && child && (
          <p className="rounded-xl bg-muted p-4 text-sm">
            {tBook('suggested', {
              age: child.age,
              density: tBook(`densities.${suggested.textDensity}.name`),
              level: tBook(`levels.${suggested.readingLevel}.name`),
            })}
          </p>
        )}
        <Chips
          name="book-length"
          legend={t('length')}
          values={lengths}
          selected={length}
          label={(value) => tBook(`lengths.${value}.name`)}
          hint={(value) => tBook('pages', { count: editorial.lengths[value].interiorPages })}
          onSelect={setLength}
        />
        <Chips
          name="text-density"
          legend={tBook('densityLegend')}
          values={densities}
          selected={textDensity}
          label={(value) => tBook(`densities.${value}.name`)}
          hint={(value) => tBook(`densities.${value}.text`)}
          onSelect={setTextDensity}
        />
        <Chips
          name="reading-level"
          legend={tBook('levelLegend')}
          values={levels}
          selected={readingLevel}
          label={(value) => tBook(`levels.${value}.name`)}
          hint={(value) => tBook(`levels.${value}.text`)}
          onSelect={setReadingLevel}
        />
        <p className="rounded-xl bg-secondary p-4 text-sm">{t('notice')}</p>
      </div>
    </WizardShell>
  );
}
