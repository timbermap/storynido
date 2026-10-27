'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { AVATAR_OPTIONS, type Avatar, type AvatarTrait } from '@storynido/shared';

import { getFirebaseDb } from '@/lib/firebase/client';
import { updateBook } from '@/lib/firebase/drafts';
import { cn } from '@/lib/utils';

import { CharacterModeChooser } from './character-mode';
import type { StepNav, WizardData } from './types';
import { WizardShell } from './wizard-shell';

/** Muestras de color orientativas (el nombre del rasgo siempre acompaña al color). */
const SWATCHES: Partial<Record<AvatarTrait, Record<string, string>>> = {
  skinTone: {
    'very-light': '#f6dcc8',
    light: '#eec4a4',
    medium: '#d9a77f',
    tan: '#c08a5c',
    brown: '#8d5a3b',
    deep: '#5b3a29',
  },
  hairColor: {
    black: '#1f1a17',
    'dark-brown': '#4a2f22',
    'light-brown': '#8a5a3a',
    blond: '#d8b469',
    red: '#b5532c',
  },
  eyeColor: {
    brown: '#5a3a24',
    hazel: '#8a6a35',
    green: '#4f7a4a',
    blue: '#4f7fb8',
    gray: '#8a9199',
  },
};

type Draft = Partial<Omit<Avatar, 'glasses'>> & { glasses: boolean };

/** Modo sin foto: rasgos del protagonista para ilustrarlo de forma consistente. */
export function StepAvatar({ nav, data }: { nav: StepNav; data: WizardData }) {
  const t = useTranslations('Wizard.character');
  const [avatar, setAvatar] = useState<Draft>(data.book.avatar ?? { glasses: false });
  const [error, setError] = useState<string | null>(null);
  const traits = Object.keys(AVATAR_OPTIONS) as AvatarTrait[];

  async function next() {
    if (traits.some((trait) => !avatar[trait])) {
      setError(t('required'));
      return;
    }
    const ok = await nav.save(async () => {
      await updateBook(await getFirebaseDb(), data.book.id, { avatar: avatar as Avatar });
    });
    if (ok) await nav.goNext();
  }

  return (
    <WizardShell
      {...nav}
      title={t('avatarTitle')}
      subtitle={t('avatarSubtitle')}
      error={error}
      onNext={() => void next()}
    >
      <div className="grid gap-8">
        <CharacterModeChooser nav={nav} data={data} />

        {traits.map((trait) => (
          <fieldset key={trait}>
            <legend className="mb-3 font-bold">{t(trait)}</legend>
            <div className="flex flex-wrap gap-2">
              {AVATAR_OPTIONS[trait].map((value) => {
                const checked = avatar[trait] === value;
                const swatch = SWATCHES[trait]?.[value];
                return (
                  <label
                    key={value}
                    className={cn(
                      'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 bg-card px-4 text-sm font-bold transition has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                      checked
                        ? 'border-primary bg-[#faf6fd]'
                        : 'border-border hover:border-primary/40',
                    )}
                  >
                    <input
                      type="radio"
                      name={`avatar-${trait}`}
                      value={value}
                      checked={checked}
                      onChange={() => {
                        setAvatar((current) => ({ ...current, [trait]: value }));
                        setError(null);
                      }}
                      className="sr-only"
                    />
                    {swatch && (
                      <span
                        aria-hidden="true"
                        className="size-5 rounded-full border border-black/10"
                        style={{ backgroundColor: swatch }}
                      />
                    )}
                    {t(`options.${trait}.${value}`)}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}

        <label className="inline-flex items-center gap-3 font-bold">
          <input
            type="checkbox"
            className="size-5 accent-[var(--primary)]"
            checked={avatar.glasses}
            onChange={(event) => {
              setAvatar((current) => ({ ...current, glasses: event.target.checked }));
            }}
          />
          {t('glasses')}
        </label>
      </div>
    </WizardShell>
  );
}
