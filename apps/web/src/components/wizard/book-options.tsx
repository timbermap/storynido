'use client';

import { ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import {
  BOOK_LENGTHS,
  READING_LEVELS,
  TEXT_DENSITIES,
  readingFormatsFor,
  wordsForAge,
  type BookLength,
  type ContentType,
  type EditorialConfig,
  type Locale,
  type PublicStory,
  type ReadingLevel,
  type TextDensity,
} from '@storynido/shared';

import { useProStatus } from '@/components/pro/use-pro-status';
import { formatPrice } from '@/lib/format';
import { bookPrices } from '@/lib/offer';
import { cn } from '@/lib/utils';

import { OptionCard } from './option-card';
import type { PriceHint } from './types';

export interface BookChoice {
  length: BookLength;
  textDensity: TextDensity;
  readingLevel: ReadingLevel;
  contentType: ContentType;
}

/** Orden en el que se ofrecen los tipos (el más simple primero). */
const TYPE_ORDER: ContentType[] = ['story', 'story_activities', 'coloring', 'activities'];

export function Chips<T extends string>({
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
              selected === value ? 'border-navy bg-card' : 'border-border hover:border-navy/40',
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
  prices = null,
  age,
  value,
  onChange,
}: {
  story: PublicStory | undefined;
  editorial: EditorialConfig;
  /** Sin precios (Eventos: el kit tiene los suyos, o un país donde no se vende) no se muestran. */
  prices?: PriceHint | null;
  age: number | null;
  value: BookChoice;
  onChange: (value: BookChoice) => void;
}) {
  const t = useTranslations('Wizard.book');
  const locale = useLocale() as Locale;
  const { status: proStatus } = useProStatus();
  const professional = proStatus?.accountType === 'professional';
  const money = (minor: number) =>
    prices ? formatPrice(minor, prices.currency, locale, prices.country) : '';
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
  // Formatos de la edad que la historia admite; sin ninguno, queda la extensión de siempre.
  const readingFormats = readingFormatsFor(age).filter(
    (format) =>
      lengths.includes(format.length) &&
      densities.includes(format.textDensity) &&
      levels.includes(format.readingLevel) &&
      editorial.lengths[format.length].active,
  );
  const byFormat = !coloring && value.contentType !== 'activities' && readingFormats.length > 0;
  const current = readingFormats.find(
    (format) =>
      format.length === value.length &&
      format.textDensity === value.textDensity &&
      format.readingLevel === value.readingLevel,
  );

  // Si se ajusta a mano y ya no coincide con ninguno, queda marcado el más parecido (no se
  // "borra" la elección): el aviso de abajo dice que está ajustado.
  const score = (format: (typeof readingFormats)[number]) =>
    Number(format.length === value.length) * 2 +
    Number(format.textDensity === value.textDensity) +
    Number(format.readingLevel === value.readingLevel);
  const selectedFormat =
    current ??
    readingFormats.reduce<(typeof readingFormats)[number] | undefined>(
      (best, format) => (!best || score(format) > score(best) ? format : best),
      undefined,
    );
  // Lo sugerido para la edad es el formato recomendado, no lo que está elegido ahora.
  const suggestedFormat = readingFormats.find((format) => format.recommended) ?? current;

  return (
    <section aria-labelledby="book-options" className="mt-10 grid gap-8 border-t pt-8">
      <h2 id="book-options" className="text-2xl font-medium">
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

      {byFormat ? (
        <fieldset>
          <legend className="mb-3 font-bold">{t('formatLegend')}</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {readingFormats.map((format) => {
              // Las palabras salen de la franja de la edad (± un escalón por la densidad).
              const range =
                age === null
                  ? {
                      min: editorial.densities[format.textDensity].minWords,
                      max: editorial.densities[format.textDensity].maxWords,
                    }
                  : wordsForAge(age, format.textDensity, editorial);
              const words = { minWords: range.min, maxWords: range.max };
              return (
                <OptionCard
                  key={format.key}
                  name="reading-format"
                  value={format.key}
                  checked={selectedFormat?.key === format.key}
                  onSelect={() => {
                    set({
                      length: format.length,
                      textDensity: format.textDensity,
                      readingLevel: format.readingLevel,
                    });
                  }}
                >
                  <span className="flex flex-1 flex-col gap-1.5 p-4 pr-11">
                    <span className="font-display text-lg leading-tight font-semibold">
                      {t(`formats.${format.key}.name`)}
                    </span>
                    {format.recommended && (
                      <span className="w-fit rounded-full bg-mint px-2.5 py-1 text-xs leading-none font-bold text-success">
                        {t('formatRecommended')}
                      </span>
                    )}
                    <span className="text-sm leading-snug text-muted-foreground">
                      {t(`formats.${format.key}.text`)}
                    </span>
                    <span className="mt-auto pt-2 text-sm font-bold text-primary">
                      {t('formatPages', { count: editorial.lengths[format.length].interiorPages })}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {t('formatWords', { min: words.minWords, max: words.maxWords })}
                    </span>
                  </span>
                </OptionCard>
              );
            })}
          </div>
          {!current && <p className="mt-2 text-sm text-muted-foreground">{t('formatCustom')}</p>}
        </fieldset>
      ) : (
        <fieldset>
          <legend className="mb-3 font-bold">{t('lengthLegend')}</legend>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {lengths.map((length) => {
              const config = editorial.lengths[length];
              const printed = config.formats.filter((format) => format !== 'digital');
              const printable = printed.length > 0;
              // Los libros cortos se imprimen como cuento grapado; los largos, como libro físico.
              const printLabel = printed.every((format) => format === 'booklet')
                ? t('chipBooklet')
                : t('chipPrint');
              const lengthPrice = prices
                ? bookPrices(prices, length, professional, value.contentType)
                : null;
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
                  <span className="flex flex-1 flex-col gap-1.5 p-4 pr-11">
                    <span className="font-display text-lg leading-tight font-semibold">
                      {t(`lengths.${length}.name`)}
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {t('pages', { count: config.interiorPages })}
                    </span>
                    <span className="text-sm leading-snug text-muted-foreground">
                      {t(`lengths.${length}.text`)}
                    </span>
                    <span className="mt-auto flex flex-wrap gap-1.5 pt-2">
                      <span className="rounded-full border bg-card px-2.5 py-1 text-xs leading-none font-bold whitespace-nowrap">
                        {t('chipEbook')}
                      </span>
                      {printable && (
                        <span className="rounded-full bg-accent px-2.5 py-1 text-xs leading-none font-bold whitespace-nowrap">
                          {printLabel}
                        </span>
                      )}
                    </span>
                    {lengthPrice?.digital != null && (
                      // El precio exacto de esa extensión (el mismo del pago), sin envío.
                      <span className="grid gap-0.5 border-t pt-2 text-xs font-semibold tabular-nums">
                        <span>{t('priceDigital', { price: money(lengthPrice.digital) })}</span>
                        {printable && lengthPrice.printed != null && (
                          <span>
                            {t(
                              lengthPrice.printedFormats.length > 1
                                ? 'pricePrintedFrom'
                                : 'pricePrinted',
                              { price: money(lengthPrice.printed) },
                            )}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </OptionCard>
              );
            })}
          </div>
        </fieldset>
      )}

      {!coloring && (
        <details className="group rounded-xl border bg-card p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold">
            <span>
              {t('adjust')}
              <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
                {t('suggested', {
                  age: age ?? 0,
                  density: t(`densities.${(suggestedFormat ?? value).textDensity}.name`),
                  level: t(`levels.${(suggestedFormat ?? value).readingLevel}.name`),
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
