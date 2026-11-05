'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  LOCALES,
  STORY_GROUPS,
  storyGroups,
  suggestedReading,
  type Locale,
  type PublicStory,
  type StoryGroup,
} from '@storynido/shared';

import { StoryCover } from '@/components/stories/story-cover';
import { getFirebaseDb } from '@/lib/firebase/client';
import { updateBook } from '@/lib/firebase/drafts';
import { titleForChild } from '@/lib/story-title';
import { cn } from '@/lib/utils';

import { BookOptions, type BookChoice } from './book-options';
import { ChosenSummary } from './chosen-summary';
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
        }
      : {
          length: data.book.length ?? data.editorial.defaults.length,
          textDensity: data.book.textDensity,
          readingLevel: data.book.readingLevel,
        }),
  }));
  const story = data.stories.find((item) => item.slug === selected);
  // Viene con la historia elegida (desde el catálogo): resumen y «Cambiar», no toda la grilla.
  const tWizard = useTranslations('Wizard');
  const [expanded, setExpanded] = useState(!data.book.storyId);

  const fits = (min: number, max: number) => age !== undefined && min <= age && age <= max;
  // Solo las historias de la línea del libro, no las de otra línea que también la incluyen.
  // Si no hubiera ninguna, todas.
  const channel = data.book.channel;
  const forChannel = data.stories.filter((item) => item.channels[0] === channel);
  // Con una enseñanza elegida, las historias que la sugieren van primero («Ideal para…»).
  const lesson = data.lessons.find((item) => data.book.lessonIds.includes(item.slug));
  const forLesson = (story: PublicStory) =>
    lesson !== undefined && (story.suggestedLessons?.includes(lesson.slug) ?? false);
  const ordered = (forChannel.length > 0 ? forChannel : data.stories).toSorted(
    (a, b) =>
      Number(forLesson(b)) - Number(forLesson(a)) ||
      Number(fits(b.ageMin, b.ageMax)) - Number(fits(a.ageMin, a.ageMax)),
  );

  // Filtros (UX, marketing y producto): edad (por defecto, la suya) y un tema a la vez, con
  // los grupos de STORY_GROUPS. La historia elegida se ve siempre, primera.
  const [ageOnly, setAgeOnly] = useState(age !== undefined);
  const [group, setGroup] = useState<StoryGroup | null>(null);
  const byAge = ordered.filter((item) => !ageOnly || fits(item.ageMin, item.ageMax));
  const groups = STORY_GROUPS.map(({ key }) => ({
    key,
    count: byAge.filter((item) => storyGroups(item).includes(key)).length,
  })).filter((item) => item.count > 0);
  const matches = byAge.filter((item) => !group || storyGroups(item).includes(group));
  const chosen = ordered.find((item) => item.slug === selected);
  const visible = [
    ...(chosen ? [chosen] : []),
    ...matches.filter((item) => item.slug !== selected),
  ];
  const showFilters = ordered.length > 6;
  const childName = data.child?.name ?? '';
  function showAll() {
    setAgeOnly(false);
    setGroup(null);
  }

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
      {!expanded && story ? (
        <ChosenSummary
          story={story}
          title={titleForChild(story, data.child?.name, locale)}
          detail={lesson ? tWizard('chosenLesson', { name: lesson.name }) : null}
          onChange={() => {
            setExpanded(true);
          }}
        />
      ) : (
        // min-w-0: un fieldset crece con su contenido; así la fila de chips se desplaza sola.
        <fieldset className="min-w-0">
          <legend className="sr-only">{t('title')}</legend>
          {showFilters && (
            // Una fila de chips; en el móvil, con scroll horizontal (sin dropdowns ni buscador).
            <div
              role="group"
              aria-label={t('filtersLabel')}
              className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible"
            >
              {age !== undefined && (
                <FilterChip
                  track="age"
                  active={ageOnly}
                  count={ordered.filter((item) => fits(item.ageMin, item.ageMax)).length}
                  onClick={() => {
                    setAgeOnly(true);
                  }}
                >
                  {childName
                    ? t('filterAge', { name: childName, age })
                    : t('filterAgeNoName', { age })}
                </FilterChip>
              )}
              <FilterChip
                track="all_ages"
                active={!ageOnly}
                count={ordered.length}
                onClick={() => {
                  setAgeOnly(false);
                }}
              >
                {t('filterAllAges')}
              </FilterChip>
              <span aria-hidden="true" className="mx-1 w-px shrink-0 self-stretch bg-border" />
              {groups.map(({ key, count }) => (
                <FilterChip
                  key={key}
                  track={key}
                  active={group === key}
                  count={count}
                  onClick={() => {
                    setGroup((current) => (current === key ? null : key));
                  }}
                >
                  {t(`groups.${key}`)}
                </FilterChip>
              ))}
            </div>
          )}
          {matches.length === 0 && (
            <p role="status" className="mb-4 text-sm text-muted-foreground">
              {t('filterEmpty')}{' '}
              <button
                type="button"
                className="font-semibold text-primary underline-offset-4 hover:underline"
                onClick={showAll}
              >
                {t('filterShowAll')}
              </button>
            </p>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {visible.map((story) => (
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
      )}

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
        prices={data.prices}
        age={age ?? null}
        value={fitToStory(choice, story)}
        onChange={setChoice}
      />
    </WizardShell>
  );
}

/** Si la historia no admite alguna opción elegida, se usa la primera que sí admite. */
export function fitToStory(choice: BookChoice, story: PublicStory | undefined): BookChoice {
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

/** Píldora de filtro (como «Le encanta» del catálogo): un toque la activa, otro la quita. */
function FilterChip({
  active,
  onClick,
  count,
  track,
  children,
}: {
  track: string;
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      data-track="story_filter"
      data-track-filter={track}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[0.8rem] font-semibold whitespace-nowrap transition',
        active
          ? 'border-secondary bg-secondary text-secondary-foreground'
          : 'bg-card hover:border-foreground/30',
      )}
    >
      {children}
      <span
        className={cn(
          'text-xs font-medium tabular-nums',
          active ? 'text-secondary-foreground/80' : 'text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  );
}
