'use client';

import { ArrowRight, BookHeart, Cake, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cardClass } from '@/components/home/session/parts';
import { Link } from '@/i18n/navigation';
import type { ChildSummary } from '@/lib/firebase/account';
import { ideasFor, type IdeaKind } from '@/lib/library';
import { cn } from '@/lib/utils';

import { useCreateWith } from './characters-panel';

const ICONS: Record<IdeaKind, typeof Sparkles> = {
  likes: Sparkles,
  birthday: Cake,
  moment: BookHeart,
};

const ACTION =
  'inline-flex min-h-10 items-center gap-1.5 justify-self-start text-sm font-bold text-primary underline-offset-4 hover:underline';

/** «Ideas para {personaje}»: hasta tres, armadas con lo que se sabe de verdad del personaje. */
export function Ideas({ child, hasKit }: { child: ChildSummary; hasKit: boolean }) {
  const t = useTranslations('Account.myStories.library.ideas');
  const createWith = useCreateWith();
  const ideas = ideasFor(child, { hasKit });
  const name = child.name;

  return (
    <section aria-labelledby="ideas-title" className="grid gap-4">
      <h2 id="ideas-title" className="text-xl font-bold sm:text-2xl">
        {t('title', { name })}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        {ideas.map((idea) => {
          const Icon = ICONS[idea.kind];
          const values = { name, like: idea.like ?? '' };
          return (
            <li key={idea.kind} className={cn(cardClass, 'grid content-start gap-2 p-5')}>
              <Icon className="size-5 text-primary" aria-hidden="true" />
              <p className="font-serif text-lg leading-snug font-semibold">
                {t(`${idea.kind}.title`, values)}
              </p>
              <p className="text-sm text-muted-foreground">{t(`${idea.kind}.text`, values)}</p>
              {idea.kind === 'moment' ? (
                <Link
                  href="/lessons"
                  data-track="idea"
                  data-track-idea={idea.kind}
                  className={ACTION}
                >
                  {t(`${idea.kind}.cta`)}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              ) : (
                <button
                  type="button"
                  data-track="idea"
                  data-track-idea={idea.kind}
                  onClick={() => {
                    createWith(child.id, idea.kind === 'birthday' ? 'events' : 'families');
                  }}
                  className={ACTION}
                >
                  {t(`${idea.kind}.cta`)}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
