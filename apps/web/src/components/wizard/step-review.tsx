'use client';

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

import type { StepNav, WizardData } from './types';
import { WizardShell } from './wizard-shell';

export function StepReview({ nav, data }: { nav: StepNav; data: WizardData }) {
  const t = useTranslations('Wizard.review');
  const { book, child } = data;
  const story = data.stories.find((s) => s.slug === book.storyId);
  const chosen = book.lessonIds
    .map((slug) => data.lessons.find((l) => l.slug === slug)?.name)
    .filter((name): name is string => Boolean(name));
  if (book.customLesson) chosen.push(`${t('customLesson')}: “${book.customLesson}”`);
  const style = data.styles.find((s) => s.slug === book.styleId);

  const rows: { label: string; value: string; step: number }[] = [
    { label: t('protagonist'), value: child?.name ?? '—', step: 0 },
    { label: t('photos'), value: t('photoCount', { count: book.photoIds.length }), step: 1 },
    { label: t('adventure'), value: story?.title ?? '—', step: 2 },
    {
      label: t('lesson'),
      value: chosen.length > 0 ? chosen.join(' · ') : t('noLesson'),
      step: 3,
    },
    { label: t('style'), value: style?.name ?? '—', step: 4 },
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
        <Button size="lg" disabled aria-describedby="preview-soon">
          <Sparkles aria-hidden="true" />
          {t('generate')}
        </Button>
        <p id="preview-soon" className="text-sm text-muted-foreground">
          {t('comingSoon')}
        </p>
      </div>
    </WizardShell>
  );
}
