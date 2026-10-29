'use client';

import { Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { MEMORY_KEYS } from '@storynido/shared';

import { Button } from '@/components/ui/button';

import { WIZARD_STEPS } from './steps';
import type { StepNav, WizardData } from './types';
import { WizardShell } from './wizard-shell';

export function StepReview({
  nav,
  data,
  onGenerate,
  onViewPreview,
}: {
  nav: StepNav;
  data: WizardData;
  onGenerate: () => void;
  /** Solo si ya hay una muestra generada. */
  onViewPreview?: () => void;
}) {
  const t = useTranslations('Wizard.review');
  const locale = useLocale();
  const tBook = useTranslations('Wizard.book');
  const { book, child } = data;
  const story = data.stories.find((s) => s.slug === book.storyId);
  const chosen = book.lessonIds
    .map((slug) => data.lessons.find((l) => l.slug === slug)?.name)
    .filter((name): name is string => Boolean(name));
  if (book.customLesson) chosen.push(`${t('customLesson')}: “${book.customLesson}”`);
  const style = data.styles.find((s) => s.slug === book.styleId);

  const memories = MEMORY_KEYS.filter((key) => book.memories?.[key]).length;
  const step = (name: (typeof WIZARD_STEPS)[number]) => WIZARD_STEPS.indexOf(name);

  const event = book.channel === 'events' ? book.event : null;
  const tOccasions = useTranslations('Wizard.child.event.occasions');
  const eventValue = event
    ? [
        tOccasions(event.type),
        event.type === 'birthday' && event.turningAge
          ? t('eventTurning', { count: event.turningAge })
          : null,
        event.date
          ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
              new Date(`${event.date}T00:00:00Z`),
            )
          : null,
        event.theme,
      ]
        .filter(Boolean)
        .join(' · ') || t('eventEmpty')
    : null;

  const rows: { label: string; value: string; step: number }[] = [
    { label: t('protagonist'), value: child?.name ?? '—', step: step('child') },
    ...(eventValue ? [{ label: t('event'), value: eventValue, step: step('child') }] : []),
    {
      label: t('character'),
      value:
        book.characterMode === 'avatar'
          ? t('characterAvatar')
          : `${t('characterPhoto')} · ${t('photoCount', { count: book.photoIds.length })}`,
      step: step('photos'),
    },
    { label: t('adventure'), value: story?.title ?? '—', step: step('story') },
    {
      label: t('book'),
      value: [
        book.length
          ? `${tBook(`lengths.${book.length}.name`)} · ${tBook('pages', { count: data.editorial.lengths[book.length].interiorPages })}`
          : null,
        tBook(`types.${book.contentType}.name`),
        book.contentType === 'coloring' ? null : tBook(`densities.${book.textDensity}.name`),
        book.contentType === 'coloring' ? null : tBook(`levels.${book.readingLevel}.name`),
      ]
        .filter(Boolean)
        .join(' · '),
      step: step('story'),
    },
    {
      label: t('memories'),
      value: t('memoriesCount', { count: memories }),
      step: step('memories'),
    },
    {
      label: t('lesson'),
      value: chosen.length > 0 ? chosen.join(' · ') : t('noLesson'),
      step: step('lesson'),
    },
    { label: t('style'), value: style?.name ?? '—', step: step('style') },
  ];

  const visibleRows = rows.filter((row) => {
    const name = WIZARD_STEPS[row.step];
    return name === undefined || !nav.hidden.includes(name);
  });

  return (
    <WizardShell {...nav} title={t('title')} subtitle={t('subtitle')}>
      <dl className="divide-y rounded-xl border">
        {visibleRows.map((row) => (
          // dt y dd como hijos directos del grupo (lista de definición válida para lectores de
          // pantalla); el botón va en su propio dd, a la derecha.
          <div key={row.label} className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-5 py-4">
            <dt className="text-sm font-bold text-muted-foreground">{row.label}</dt>
            <dd className="col-start-1 mt-0.5 font-semibold">{row.value}</dd>
            <dd className="col-start-2 row-span-2 row-start-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${t('edit')}: ${row.label}`}
                onClick={() => {
                  nav.onJump(row.step);
                }}
              >
                {t('edit')}
              </Button>
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-8 grid gap-2">
        <Button size="lg" onClick={onGenerate} aria-describedby="preview-note">
          <Sparkles aria-hidden="true" />
          {t('generate')}
        </Button>
        <p id="preview-note" className="text-sm text-muted-foreground">
          {t('generateNote')}
        </p>
        {onViewPreview && (
          <Button variant="outline" onClick={onViewPreview}>
            {t('viewPreview')}
          </Button>
        )}
      </div>
    </WizardShell>
  );
}
