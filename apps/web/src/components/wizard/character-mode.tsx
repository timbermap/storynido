'use client';

import { Camera, Palette } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { CharacterMode } from '@storynido/shared';

import { getFirebaseDb } from '@/lib/firebase/client';
import { updateBook } from '@/lib/firebase/drafts';

import { OptionCard } from './option-card';
import type { StepNav, WizardData } from './types';

/** Con su foto o sin foto: el cambio se guarda y el paso muestra el formulario que corresponde. */
export function CharacterModeChooser({ nav, data }: { nav: StepNav; data: WizardData }) {
  const t = useTranslations('Wizard.character');
  const mode = data.book.characterMode;

  function choose(value: string) {
    if (value === mode) return;
    void nav.save(async () => {
      await updateBook(await getFirebaseDb(), data.book.id, {
        characterMode: value as CharacterMode,
      });
    });
  }

  const options = [
    { value: 'photo', icon: Camera, title: t('photo'), text: t('photoText') },
    { value: 'avatar', icon: Palette, title: t('avatar'), text: t('avatarText') },
  ];

  return (
    <fieldset>
      <legend className="mb-3 font-bold">{t('modeLegend')}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map(({ value, icon: Icon, title, text }) => (
          <OptionCard
            key={value}
            name="character-mode"
            value={value}
            checked={mode === value}
            onSelect={choose}
          >
            <span className="flex gap-3 p-4 pr-12">
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                <span className="block font-display text-lg font-semibold">{title}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{text}</span>
              </span>
            </span>
          </OptionCard>
        ))}
      </div>
    </fieldset>
  );
}
