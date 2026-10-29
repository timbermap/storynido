'use client';

import { useTranslations } from 'next-intl';

import { AVATAR_OPTIONS, type Avatar, type AvatarTrait } from '@storynido/shared';

import { cn } from '@/lib/utils';

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

export type TraitDraft = Partial<Omit<Avatar, 'glasses'>> & { glasses: boolean };

export const AVATAR_TRAITS = Object.keys(AVATAR_OPTIONS) as AvatarTrait[];

/** Rasgos del protagonista como chips (modo sin foto y corrección del personaje). */
export function TraitPicker({
  value,
  onChange,
  idPrefix,
  only,
  showGlasses = true,
}: {
  value: TraitDraft;
  onChange: (value: TraitDraft) => void;
  idPrefix: string;
  /** Solo estos rasgos (corrección guiada: lo que no se parece). */
  only?: readonly AvatarTrait[];
  showGlasses?: boolean;
}) {
  const t = useTranslations('Wizard.character');
  return (
    <div className="grid gap-8">
      {(only ?? AVATAR_TRAITS).map((trait) => (
        <fieldset key={trait}>
          <legend className="mb-3 font-bold">{t(trait)}</legend>
          <div className="flex flex-wrap gap-2">
            {AVATAR_OPTIONS[trait].map((option) => {
              const checked = value[trait] === option;
              const swatch = SWATCHES[trait]?.[option];
              return (
                <label
                  key={option}
                  className={cn(
                    'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 bg-card px-4 text-sm font-bold transition has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                    checked
                      ? 'border-primary bg-[#f6f1fc]'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <input
                    type="radio"
                    name={`${idPrefix}-${trait}`}
                    value={option}
                    checked={checked}
                    onChange={() => {
                      onChange({ ...value, [trait]: option });
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
                  {t(`options.${trait}.${option}`)}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      {showGlasses && (
        <label className="inline-flex items-center gap-3 font-bold">
          <input
            type="checkbox"
            className="size-5 accent-[var(--primary)]"
            checked={value.glasses}
            onChange={(event) => {
              onChange({ ...value, glasses: event.target.checked });
            }}
          />
          {t('glasses')}
        </label>
      )}
    </div>
  );
}
