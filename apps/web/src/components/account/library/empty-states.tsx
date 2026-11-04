'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cardClass } from '@/components/home/session/parts';
import { Button, buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import type { ChildSummary } from '@/lib/firebase/account';
import { cn } from '@/lib/utils';

import { useCreateWith } from './characters-panel';

/**
 * Cuenta nueva: qué va en cada solapa y cómo empezar (el botón durazno, porque todavía no hay
 * «Lo próximo»), con los caminos del kit y del proyecto profesional.
 */
export function Welcome() {
  const t = useTranslations('Account.myStories');
  const tLib = useTranslations('Account.myStories.library.welcome');
  return (
    <section
      id="new"
      aria-labelledby="new-title"
      className={cn(cardClass, 'grid scroll-mt-28 gap-5 rounded-[1.375rem] p-5 sm:p-7')}
    >
      <div className="grid gap-2">
        <h2 id="new-title" className="text-2xl font-bold">
          {t('newTitle')}
        </h2>
        <p className="text-muted-foreground">{tLib('text')}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {(['creating', 'inProgress', 'done', 'characters'] as const).map((key) => (
          <li key={key} className="rounded-xl bg-muted p-4">
            <p className="font-bold">{tLib(`${key}.title`)}</p>
            <p className="text-sm text-muted-foreground">{tLib(`${key}.text`)}</p>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link
          href={{ pathname: '/create', query: { line: 'families' } }}
          data-track="new_choice"
          data-track-line="families"
          className={buttonVariants({ size: 'lg' })}
        >
          {tLib('cta')}
          <ArrowRight className="size-5" aria-hidden="true" />
        </Link>
        <Link
          href={{ pathname: '/create', query: { line: 'events' } }}
          data-track="new_choice"
          data-track-line="events"
          className="font-bold text-primary underline-offset-4 hover:underline"
        >
          {tLib('kit')}
        </Link>
        <Link
          href={{ pathname: '/create', query: { line: 'professionals' } }}
          data-track="new_choice"
          data-track-line="professionals"
          className="font-bold text-primary underline-offset-4 hover:underline"
        >
          {tLib('pro')}
        </Link>
      </div>
    </section>
  );
}

/** Solapa vacía, siempre con una salida (con un personaje, crearle otro cuento). */
export function EmptyState({
  kind,
  child,
  hasIdeas = false,
}: {
  kind: 'creating' | 'inProgress' | 'done';
  child: ChildSummary | null;
  /** Debajo van las «Ideas para…»: ellas son la acción, así que acá queda solo el texto. */
  hasIdeas?: boolean;
}) {
  const t = useTranslations('Account.myStories.library.empty');
  const createWith = useCreateWith();
  return (
    <div className="grid justify-items-start gap-3 rounded-2xl border border-dashed border-navy/25 p-6">
      <p className="text-muted-foreground">
        {kind === 'creating' && child && !hasIdeas
          ? t('creatingWithCharacter', { name: child.name })
          : t(kind)}
      </p>
      {kind === 'creating' && child && !hasIdeas && (
        <Button
          variant="outline"
          data-track="crear-con-personaje"
          onClick={() => {
            createWith(child.id);
          }}
        >
          {t('createWith', { name: child.name })}
        </Button>
      )}
      {!(kind === 'creating' && child) && !(kind === 'creating' && hasIdeas) && (
        <Link
          href={{ pathname: '/create', query: { line: 'families' } }}
          className="font-bold text-primary underline-offset-4 hover:underline"
        >
          {t('start')}
        </Link>
      )}
    </div>
  );
}
