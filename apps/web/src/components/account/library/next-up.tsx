'use client';

import { ArrowRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ComponentProps } from 'react';

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
import type { HomeNext } from '@/lib/home-state';
import { cn } from '@/lib/utils';

type Href = ComponentProps<typeof Link>['href'];

/**
 * «Lo próximo»: lo que pide una acción ahora (la muestra lista, el personaje por aprobar, lo que
 * se está dibujando o el pedido en curso), con el único botón durazno de la pantalla.
 */
export function NextUp({
  next,
  lines,
  stories,
}: {
  next: HomeNext;
  lines: LineCopy;
  stories: PublicStory[];
}) {
  const t = useTranslations('Account.myStories.library');
  const locale = useLocale();
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' });

  const item = next.kind === 'order' ? next.order : next.book;
  const key =
    next.kind === 'order'
      ? next.shipped
        ? 'shipped'
        : 'preparing'
      : next.kind === 'preview' && next.book.channel === 'events'
        ? 'kitPreview'
        : next.kind;
  const name = item.childName;
  const title = name ? t(`next.${key}.title`, { name }) : t(`next.${key}.titleNoName`);
  // La fecha estimada solo si el pedido la trae (nunca se inventa).
  const sub =
    next.kind === 'order' && next.order.etaFrom !== null && next.order.etaTo !== null
      ? t('next.eta', { from: day.format(next.order.etaFrom), to: day.format(next.order.etaTo) })
      : t(`next.${key}.sub`);
  const href: Href =
    next.kind === 'order'
      ? { pathname: '/order/[orderId]', params: { orderId: next.order.id } }
      : { pathname: '/create/[bookId]', params: { bookId: next.book.id } };
  const status =
    next.kind === 'order'
      ? t(next.shipped ? 'status.shipped' : 'status.preparing')
      : t(`status.${key}`);
  const story =
    next.kind === 'order'
      ? stories.find((s) => s.slug === next.order.storyId)
      : stories.find((s) => s.slug === next.book.storyId);
  const src =
    next.kind === 'order'
      ? next.order.coverUrl
      : next.kind === 'character'
        ? next.book.characterUrl
        : next.book.coverUrl;

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
          <StatusChip>{status}</StatusChip>
        </div>
        <h2
          id="next-title"
          className="font-serif text-[1.2rem] leading-tight font-semibold text-balance sm:text-[1.35rem]"
        >
          {title}
        </h2>
        <p className="text-muted-foreground">{sub}</p>
      </div>
      <div className="col-span-full sm:col-span-1">
        <Link
          href={href}
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
