'use client';

import { BookHeart, Cake, GraduationCap } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { Channel } from '@storynido/shared';

import { LINE_TONE } from '@/components/wizard/drafts-list';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const OPTIONS: { line: Channel; icon: typeof BookHeart }[] = [
  { line: 'families', icon: BookHeart },
  { line: 'events', icon: Cake },
  { line: 'professionals', icon: GraduationCap },
];

/** "¿Qué quieres crear?": las tres líneas, cada una explicada en una línea (DECISIONS 115). */
export function NewChoice() {
  const t = useTranslations('Account.myStories');
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {OPTIONS.map(({ line, icon: Icon }) => (
        <li key={line}>
          <Link
            href={{ pathname: '/create', query: { line } }}
            data-track="new_choice"
            data-track-line={line}
            className="flex h-full flex-col gap-2 rounded-xl border bg-card p-5 shadow-[var(--shadow-card)] transition hover:border-primary/40"
          >
            <span className={cn('grid size-10 place-items-center rounded-full', LINE_TONE[line])}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="font-semibold">{t(`newOptions.${line}.title`)}</span>
            <span className="text-sm text-muted-foreground">{t(`newOptions.${line}.text`)}</span>
            <span className="mt-auto pt-3">
              <span className={buttonVariants({ className: 'w-full' })}>{t('start')}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
