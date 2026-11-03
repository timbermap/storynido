'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { PublicStory } from '@storynido/shared';

import {
  LineChip,
  StatusChip,
  Thumb,
  cardClass,
  type LineCopy,
} from '@/components/home/session/parts';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import type { LibraryNext } from '@/lib/library';
import { cn } from '@/lib/utils';

/**
 * «Lo próximo»: lo que pide una acción ahora (la muestra lista, el personaje por aprobar, lo que
 * se está dibujando), con el único botón durazno de la pantalla.
 */
export function NextUp({
  next,
  lines,
  stories,
}: {
  next: LibraryNext;
  lines: LineCopy;
  stories: PublicStory[];
}) {
  const t = useTranslations('Account.myStories.library');

  const item = next.book;
  const key = next.kind === 'preview' && item.channel === 'events' ? 'kitPreview' : next.kind;
  const name = item.childName;
  const title = name ? t(`next.${key}.title`, { name }) : t(`next.${key}.titleNoName`);
  const story = stories.find((s) => s.slug === item.storyId);
  const src = next.kind === 'character' ? item.characterUrl : item.coverUrl;

  return (
    <section
      aria-labelledby="next-title"
      className={cn(
        cardClass,
        'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-[1.375rem] p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-6 sm:px-6 sm:py-5',
      )}
    >
      <span className="relative block aspect-[3/4] w-[68px] -rotate-2 overflow-hidden rounded-[6px_12px_12px_6px] bg-muted shadow-[0_10px_18px_-12px_rgb(38_50_74/0.5)] motion-reduce:rotate-0 sm:w-[92px]">
        <Thumb src={src} story={story} name={name} line={item.channel} sizes="92px" priority />
      </span>
      <div className="grid min-w-0 gap-1.5">
        <p className="text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">
          {t('nextLabel')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <LineChip line={item.channel} label={lines[item.channel].chip} />
          <StatusChip>{t(`status.${key}`)}</StatusChip>
        </div>
        <h2
          id="next-title"
          className="font-serif text-[1.2rem] leading-tight font-semibold text-balance sm:text-[1.35rem]"
        >
          {title}
        </h2>
        <p className="text-muted-foreground">{t(`next.${key}.sub`)}</p>
      </div>
      <div className="col-span-full sm:col-span-1">
        <Link
          href={{ pathname: '/create/[bookId]', params: { bookId: item.id } }}
          className={buttonVariants({ size: 'lg', className: 'w-full sm:w-auto' })}
          data-track="lo-proximo"
          data-track-state={key}
          data-track-line={item.channel}
        >
          {t(`next.${key}.cta`)}
          <ArrowRight className="size-5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
