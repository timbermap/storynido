'use client';

import { ArrowRight } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import type { Locale, PublicStory } from '@storynido/shared';

import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import type { HomeNext } from '@/lib/home-state';
import { cn } from '@/lib/utils';

import { LineChip, StatusChip, Thumb, cardClass, type LineCopy } from './parts';

type Href = ComponentProps<typeof Link>['href'];
export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Lo que dice y a dónde lleva la tarjeta «Lo próximo». */
export interface NextModel {
  href: Href;
  cta: string;
  title: string;
  sub: string;
  status: string;
  fine: string | null;
  /** Valor del evento de analítica `home_hero_click` (el estado de la persona). */
  trackState: string;
}

const resume = (bookId: string): Href => ({ pathname: '/create/[bookId]', params: { bookId } });

/** Estado de un libro sin comprar, para la píldora (el kit listo dice «Kit listo»). */
export function bookStatus(t: Translate, stage: string, line: string) {
  return t(`list.status.${line === 'events' && stage === 'preview' ? 'kitPreview' : stage}`);
}

/**
 * Textos y destino de «Lo próximo». Familias y pedidos usan los textos de siempre; Celebraciones
 * habla del kit de la fiesta.
 */
export function nextFor(
  next: HomeNext,
  t: Translate,
  locale: Locale,
  digitalPrice: string | null,
): NextModel {
  if (next.kind === 'order') {
    const { order, shipped } = next;
    const key = shipped ? 'orderShipped' : 'orderPreparing';
    const name = order.childName;
    const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' });
    const dated =
      shipped && order.etaFrom !== null && order.etaTo !== null
        ? t('orderShipped.subWithDate', {
            from: day.format(order.etaFrom),
            to: day.format(order.etaTo),
          })
        : null;
    return {
      href: { pathname: '/order/[orderId]', params: { orderId: order.id } },
      cta: t(`${key}.cta`),
      title: name ? t(`${key}.title`, { name }) : t(`${key}.titleNoName`),
      sub: dated ?? t(`${key}.sub`),
      status: t(shipped ? 'list.status.shipped' : 'list.status.preparing'),
      fine: null,
      trackState: shipped ? 'order_shipped' : 'order_preparing',
    };
  }

  const { book, kind } = next;
  const name = book.childName;
  const base = book.channel === 'events' ? `events.${kind}` : kind;
  const title = name ? t(`${base}.title`, { name }) : t(`${base}.titleNoName`);
  // Mientras se dibuja no hay nada que tocar en el creador: lleva a Mis cuentos, como antes.
  const href: Href = kind === 'generating' ? '/my-stories' : resume(book.id);
  let cta = t(`${base}.cta`);
  if (kind === 'preview' && book.channel !== 'events') {
    cta = name ? t('preview.cta', { name }) : t('preview.ctaNoName');
  }
  return {
    href,
    cta,
    title,
    sub: t(`${base}.sub`),
    status: bookStatus(t, kind, book.channel),
    fine:
      kind === 'preview' && book.channel === 'families' && digitalPrice
        ? t('preview.price', { price: digitalPrice })
        : null,
    trackState: kind,
  };
}

/** La única tarjeta con el botón durazno: lleva directo al borrador o al pedido. */
export function NextCard({
  next,
  model,
  lines,
  stories,
  label,
  christmas,
}: {
  next: HomeNext;
  model: NextModel;
  lines: LineCopy;
  stories: PublicStory[];
  label: string;
  /** Línea de Navidad: solo cuando lo próximo es un libro de Familias. */
  christmas: ReactNode;
}) {
  const item = next.kind === 'order' ? next.order : next.book;
  const story =
    next.kind === 'order' ? undefined : stories.find((s) => s.slug === next.book.storyId);
  const src =
    next.kind === 'order'
      ? (next.order.coverUrl ?? '/images/heroes/libro-impreso.webp')
      : next.kind === 'character'
        ? next.book.characterUrl
        : next.kind === 'preview'
          ? next.book.coverUrl
          : null;
  const familiesBook = next.kind !== 'order' && next.book.channel === 'families';
  return (
    <section
      aria-label={label}
      className={cn(
        cardClass,
        'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-[1.375rem] p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-6 sm:px-6 sm:py-5',
      )}
    >
      <span className="relative block aspect-[3/4] w-[68px] -rotate-2 overflow-hidden rounded-[6px_12px_12px_6px] bg-muted shadow-[0_10px_18px_-12px_rgb(38_50_74/0.5)] motion-reduce:rotate-0 sm:w-[92px]">
        <Thumb
          src={src}
          story={story}
          name={item.childName}
          line={item.channel}
          sizes="92px"
          priority
        />
      </span>
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap gap-1.5">
          <LineChip line={item.channel} label={lines[item.channel].chip} />
          <StatusChip>{model.status}</StatusChip>
        </div>
        <h2 className="text-[1.2rem] leading-tight font-bold text-balance sm:text-[1.35rem]">
          {model.title}
        </h2>
        <p className="text-muted-foreground">{model.sub}</p>
      </div>
      <div className="col-span-full grid gap-2 sm:col-span-1 sm:justify-items-end">
        <Link
          href={model.href}
          className={buttonVariants({ size: 'lg', className: 'w-full sm:w-auto' })}
          data-track="home_hero_click"
          data-track-state={model.trackState}
          data-track-line={item.channel}
        >
          {model.cta}
          <ArrowRight className="size-5" aria-hidden="true" />
        </Link>
        {/* El ancho de la columna lo da solo el botón: lo de abajo se ajusta a él y no la ensancha. */}
        {model.fine && (
          <p className="text-sm text-muted-foreground sm:w-0 sm:min-w-full sm:text-right">
            {model.fine}
          </p>
        )}
      </div>
      {/* Navidad en su propia fila, a lo ancho del texto y del botón (una línea larga no aprieta el título). */}
      {familiesBook && christmas && (
        <div className="col-span-full min-w-0 empty:hidden sm:col-start-2">{christmas}</div>
      )}
    </section>
  );
}
