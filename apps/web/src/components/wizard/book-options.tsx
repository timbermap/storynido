'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  BOOK_LENGTHS,
  READING_LEVELS,
  TEXT_DENSITIES,
  type BookLength,
  type ContentType,
  type EditorialConfig,
  type PublicStory,
  type ReadingLevel,
  type TextDensity,
} from '@storynido/shared';

import { cn } from '@/lib/utils';

import { OptionCard } from './option-card';

export interface BookChoice {
  length: BookLength;
  textDensity: TextDensity;
  readingLevel: ReadingLevel;
  contentType: ContentType;
}

/** Orden en el que se ofrecen los tipos (el más simple primero). */
const TYPE_ORDER: ContentType[] = ['story', 'story_activities', 'coloring', 'activities'];

function Chips<T extends string>({
  name,
  legend,
  values,
  selected,
  label,
  hint,
  onSelect,
}: {
  name: string;
  legend: string;
  values: readonly T[];
  selected: T;
  label: (value: T) => string;
  hint: (value: T) => string;
  onSelect: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 font-bold">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {values.map((value) => (
          <label
            key={value}
            className={cn(
              'cursor-pointer rounded-xl border-2 bg-card p-3 text-sm transition has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
              selected === value
                ? 'border-primary bg-[#faf6fd]'
                : 'border-border hover:border-primary/40',
            )}
          >
            <input
              type="radio"
              name={name}
              value={value}
              checked={selected === value}
              onChange={() => {
                onSelect(value);
              }}
              className="sr-only"
            />
            <span className="block font-bold">{label(value)}</span>
            <span className="mt-0.5 block text-muted-foreground">{hint(value)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * "Tu libro": tipo de contenido y extensión a la vista; cantidad de texto y nivel de lectura
 * sugeridos según la edad, en "Ajustar la lectura" (plegado para no abrumar).
 */
export function BookOptions({
  story,
  editorial,
  age,
  value,
  onChange,
}: {
  story: PublicStory | undefined;
  editorial: EditorialConfig;
  age: number | null;
  value: BookChoice;
  onChange: (value: BookChoice) => void;
}) {
  const t = useTranslations('Wizard.book');
  const set = (patch: Partial<BookChoice>) => {
    onChange({ ...value, ...patch });
  };

  const types = TYPE_ORDER.filter(
    (type) =>
      editorial.contentTypes[type].active && (story ? story.contentTypes.includes(type) : true),
  );
  const lengths = BOOK_LENGTHS.filter(
    (length) => editorial.lengths[length].active && (story ? story.lengths.includes(length) : true),
  );
  const densities = TEXT_DENSITIES.filter((density) =>
    story ? story.textDensities.includes(density) : true,
  );
  const levels = READING_LEVELS.filter((level) =>
    story ? story.readingLevels.includes(level) : true,
  );
  const coloring = value.contentType === 'coloring';

  return (
    <section aria-labelledby="book-options" className="mt-10 grid gap-8 border-t pt-8">
      <h2 id="book-options" className="text-2xl font-semibold">
        {t('title')}
      </h2>

      <fieldset>
        <legend className="mb-3 font-bold">{t('typeLegend')}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {types.map((type) => (
            <OptionCard
              key={type}
              name="content-type"
              value={type}
              checked={value.contentType === type}
              onSelect={(selected) => {
                set({ contentType: selected as ContentType });
              }}
            >
              <span className="block p-4 pr-12">
                <span className="block font-display text-lg font-semibold">
                  {t(`types.${type}.name`)}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {t(`types.${type}.text`)}
                </span>
              </span>
            </OptionCard>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-bold">{t('lengthLegend')}</legend>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {lengths.map((length) => {
            const config = editorial.lengths[length];
            const printable = config.formats.some((format) => format !== 'digital');
            return (
              <OptionCard
                key={length}
                name="length"
                value={length}
                checked={value.length === length}
                onSelect={(selected) => {
                  set({ length: selected as BookLength });
                }}
              >
                <span className="grid gap-1 p-4 pr-10">
                  <span className="font-display text-lg font-semibold">
                    {t(`lengths.${length}.name`)}
                  </span>
                  <span className="text-sm font-bold text-primary">
                    {t('pages', { count: config.interiorPages })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t(`lengths.${length}.text`)}
                  </span>
                  <span className="mt-1 w-fit rounded-full bg-secondary px-2 py-0.5 text-xs font-bold">
                    {printable ? t('digitalOrPrint') : t('digitalOnly')}
                  </span>
                </span>
              </OptionCard>
            );
          })}
        </div>
      </fieldset>

      {!coloring && (
        <details className="group rounded-xl border bg-card p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold">
            <span>
              {t('adjust')}
              <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
                {t('suggested', {
                  age: age ?? 0,
                  density: t(`densities.${value.textDensity}.name`),
                  level: t(`levels.${value.readingLevel}.name`),
                })}
              </span>
            </span>
            <ChevronDown
              className="size-5 shrink-0 transition group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="mt-5 grid gap-6">
            <Chips
              name="text-density"
              legend={t('densityLegend')}
              values={densities}
              selected={value.textDensity}
              label={(density) => t(`densities.${density}.name`)}
              hint={(density) => t(`densities.${density}.text`)}
              onSelect={(textDensity) => {
                set({ textDensity });
              }}
            />
            <Chips
              name="reading-level"
              legend={t('levelLegend')}
              values={levels}
              selected={value.readingLevel}
              label={(level) => t(`levels.${level}.name`)}
              hint={(level) => t(`levels.${level}.text`)}
              onSelect={(readingLevel) => {
                set({ readingLevel });
              }}
            />
          </div>
        </details>
      )}
    </section>
  );
}
