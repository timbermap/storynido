'use client';

import type { PublicStory } from '@storynido/shared';
import { useTranslations } from 'next-intl';

import { StoryCover } from '@/components/stories/story-cover';

/**
 * Lo que ya viene elegido desde el catálogo (cuento y enseñanza): un resumen compacto en lugar de
 * volver a mostrar todas las opciones. «Cambiar» las despliega.
 */
export function ChosenSummary({
  story,
  title,
  detail,
  onChange,
}: {
  story: PublicStory | undefined;
  title: string;
  /** Lo demás que viene elegido (la enseñanza, la colección). */
  detail?: string | null;
  onChange: () => void;
}) {
  const t = useTranslations('Wizard');
  return (
    <section
      aria-label={t('chosenTitle')}
      className="flex items-center gap-4 rounded-2xl border-2 border-navy bg-card p-4"
    >
      {story && (
        <div className="aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-lg sm:w-24">
          <StoryCover story={story} sizes="96px" />
        </div>
      )}
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {t('chosenTitle')}
        </p>
        <p className="font-display text-lg leading-snug font-semibold">{title}</p>
        {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
      </div>
      <button
        type="button"
        onClick={onChange}
        className="inline-flex min-h-11 shrink-0 items-center px-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
      >
        {t('chosenChange')}
      </button>
    </section>
  );
}
