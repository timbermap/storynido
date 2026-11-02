'use client';

import Image from 'next/image';
import type { ComponentProps } from 'react';

import type { Locale, PublicStory } from '@storynido/shared';

import { StoryCover } from '@/components/stories/story-cover';
import type { Link } from '@/i18n/navigation';
import type { HomeBook, HomeState } from '@/lib/home-state';
import { saveReuseCharacter } from '@/lib/reuse-character';
import { saveVisitorName } from '@/lib/visitor-name';

type Href = ComponentProps<typeof Link>['href'];
type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Lo que dice y hace el hero en cada estado. */
export interface HeroModel {
  href: Href;
  cta: string;
  title: string;
  sub: string;
  pill: string | null;
  fine: string | null;
  /** Valor del evento de analítica `home_hero_click` (el estado de la persona). */
  trackState: string;
  onClick?: () => void;
}

const create = (extra: Record<string, string> = {}): Href => ({
  pathname: '/create',
  query: { line: 'families', ...extra },
});
const resume = (bookId: string): Href => ({ pathname: '/create/[bookId]', params: { bookId } });

/** Qué hero toca para el estado de la persona (los textos salen de las traducciones). */
export function heroFor(
  state: HomeState,
  translate: Translate,
  locale: Locale,
  name: string | null,
  digitalPrice: string | null,
  typed: string,
): HeroModel {
  const t = translate;
  const named = (key: string) => (name ? t(`${key}.title`, { name }) : t(`${key}.titleNoName`));
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' });
  switch (state.kind) {
    case 'new':
      return {
        href: create(),
        cta: t('new.cta'),
        title: t('new.title'),
        sub: t('new.sub'),
        pill: null,
        fine: null,
        trackState: 'new',
        // El nombre que escribió queda para mostrarlo en las portadas del catálogo.
        onClick: () => {
          if (typed.trim()) saveVisitorName(typed.trim());
        },
      };
    case 'draft':
      return {
        href: resume(state.book.id),
        cta: t('draft.cta'),
        title: named('draft'),
        sub: t('draft.sub'),
        pill: t('draft.pill'),
        fine: null,
        trackState: 'draft',
      };
    case 'generating':
      return {
        href: '/my-stories',
        cta: t('generating.cta'),
        title: named('generating'),
        sub: t('generating.sub'),
        pill: t('generating.pill'),
        fine: null,
        trackState: 'generating',
      };
    case 'character':
      return {
        href: resume(state.book.id),
        cta: t('character.cta'),
        title: named('character'),
        sub: t('character.sub'),
        pill: t('character.pill'),
        fine: null,
        trackState: 'character',
      };
    case 'preview':
      return {
        href: resume(state.book.id),
        cta: name ? t('preview.cta', { name }) : t('preview.ctaNoName'),
        title: named('preview'),
        sub: t('preview.sub'),
        pill: t('preview.pill'),
        fine: digitalPrice ? t('preview.price', { price: digitalPrice }) : null,
        trackState: 'preview',
      };
    case 'order': {
      const key = state.shipped ? 'orderShipped' : 'orderPreparing';
      const { etaFrom, etaTo } = state.order;
      const dated =
        state.shipped && etaFrom !== null && etaTo !== null
          ? t('orderShipped.subWithDate', { from: day.format(etaFrom), to: day.format(etaTo) })
          : null;
      return {
        href: { pathname: '/order/[orderId]', params: { orderId: state.order.id } },
        cta: t(`${key}.cta`),
        title: named(key),
        sub: dated ?? t(`${key}.sub`),
        pill: t(`${key}.pill`),
        fine: null,
        trackState: state.shipped ? 'order_shipped' : 'order_preparing',
      };
    }
    case 'bought': {
      const childId = state.order.childId;
      return {
        href: create(),
        cta: t('bought.cta'),
        title: named('bought'),
        sub: t('bought.sub'),
        pill: t('bought.pill'),
        fine: t('bought.fine'),
        trackState: 'bought',
        onClick: () => {
          if (childId) saveReuseCharacter(childId);
        },
      };
    }
    case 'pro':
      return {
        href: { pathname: '/my-stories', hash: 'pro' },
        cta: t('pro.cta'),
        title: t('pro.title'),
        sub: t('pro.sub'),
        pill: t('pro.pill'),
        fine: null,
        trackState: 'pro',
      };
  }
}

/** Portada o personaje dentro de un marco liviano (sin sombras fuertes). */
function Frame({ children, tag }: { children: React.ReactNode; tag?: string | null }) {
  return (
    <div className="relative flex w-full max-w-[28rem] items-center justify-center rounded-[1.75rem] bg-peach/50 py-8 sm:py-10">
      <div className="relative [aspect-ratio:396/524] w-[58%] max-w-[300px] -rotate-2 overflow-hidden rounded-[5px_12px_12px_5px] bg-white shadow-[0_18px_32px_-20px_rgb(38_50_74/0.45)]">
        {children}
      </div>
      {tag && (
        <span className="absolute right-[6%] bottom-[6%] rounded-lg bg-white px-3 py-1.5 text-sm font-semibold shadow-[0_8px_18px_-12px_rgb(38_50_74/0.5)]">
          {tag}
        </span>
      )}
    </div>
  );
}

/** La imagen grande del hero (portada real si existe; si no, una de ejemplo del catálogo). */
export function HeroImage({
  state,
  stories,
  typed,
  translate,
}: {
  state: HomeState;
  stories: PublicStory[];
  typed: string;
  translate: Translate;
}) {
  const sample = stories[0];
  const byId = (id: string | null) => stories.find((story) => story.slug === id) ?? sample;
  const img = (src: string, alt: string, priority = true) => (
    // La primera pantalla carga de inmediato (nada de lazy en el hero).
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      unoptimized
      sizes="(min-width: 1024px) 300px, 60vw"
      className="object-cover"
    />
  );
  // La portada generada trae vacío el tercio de arriba: el título va encima, como en el visor del libro.
  const titled = (src: string, title: string | null) => (
    <>
      {img(src, title ?? '')}
      {title && (
        <span className="absolute inset-x-0 top-0 bg-gradient-to-b from-[#fffaf5]/95 to-transparent px-3 pt-3 pb-7 text-center font-[family-name:var(--home-display)] text-base leading-tight font-semibold sm:text-lg">
          {title}
        </span>
      )}
    </>
  );
  const cover = (story: PublicStory | undefined, name: string | null) =>
    story ? (
      <StoryCover story={story} name={name} sizes="(min-width: 1024px) 300px, 60vw" priority />
    ) : null;
  const book = (item: HomeBook) => item;

  switch (state.kind) {
    case 'new':
      return <Frame>{cover(sample, typed.trim() || null)}</Frame>;
    case 'draft': {
      const item = book(state.book);
      return <Frame>{cover(byId(item.storyId), item.childName)}</Frame>;
    }
    case 'generating':
      return (
        <Frame tag={translate('generating.tag')}>
          {img('/images/secciones/personaje.webp', '', true)}
        </Frame>
      );
    case 'character':
      return (
        <Frame>
          {img(
            state.book.characterUrl ?? '/images/secciones/personaje.webp',
            state.book.childName ?? '',
          )}
        </Frame>
      );
    case 'preview':
      return (
        <Frame
          tag={
            state.book.totalPages
              ? translate('preview.pages', { count: state.book.totalPages })
              : null
          }
        >
          {state.book.coverUrl
            ? titled(state.book.coverUrl, state.book.title)
            : cover(byId(state.book.storyId), state.book.childName)}
        </Frame>
      );
    case 'order':
      return (
        <Frame>
          {state.order.coverUrl
            ? titled(state.order.coverUrl, state.order.title)
            : img('/images/heroes/libro-impreso.webp', '')}
        </Frame>
      );
    case 'bought':
      return (
        <Frame
          tag={
            state.order.childName ? translate('bought.tag', { name: state.order.childName }) : null
          }
        >
          {img(
            state.order.characterUrl ?? state.order.coverUrl ?? '/images/secciones/personaje.webp',
            '',
          )}
        </Frame>
      );
    case 'pro':
      return <Frame>{img('/images/secciones/personaje.webp', '')}</Frame>;
  }
}
