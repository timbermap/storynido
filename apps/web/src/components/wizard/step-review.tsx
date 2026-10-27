'use client';

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

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
  const { book, child } = data;
  const story = data.stories.find((s) => s.slug === book.storyId);
  const chosen = book.lessonIds
    .map((slug) => data.lessons.find((l) => l.slug === slug)?.name)
    .filter((name): name is string => Boolean(name));
  if (book.customLesson) chosen.push(`${t('customLesson')}: “${book.customLesson}”`);
  const style = data.styles.find((s) => s.slug === book.styleId);

  const memories = MEMORY_KEYS.filter((key) => book.memories?.[key]).length;
  const step = (name: (typeof WIZARD_STEPS)[number]) => WIZARD_STEPS.indexOf(name);

  const rows: { label: string; value: string; step: number }[] = [
    { label: t('protagonist'), value: child?.name ?? '—', step: step('child') },
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

  return (
    <WizardShell {...nav} title={t('title')} subtitle={t('subtitle')}>
      <dl className="divide-y rounded-xl border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <dt className="text-sm font-bold text-muted-foreground">{row.label}</dt>
              <dd className="mt-0.5 font-semibold">{row.value}</dd>
            </div>
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
