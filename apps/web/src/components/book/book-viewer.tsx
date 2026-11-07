'use client';

import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { splitCoverTitle, type StoryTypography } from '@storynido/shared';

import { CoverTitle } from '@/components/stories/story-cover';
import { cn } from '@/lib/utils';

export interface ViewerPage {
  key: string;
  kind: 'cover' | 'dedication' | 'story' | 'end';
  /** Ilustración (URL firmada con marca de agua o imagen pública de ejemplo). */
  imageUrl: string | null;
  text: string | null;
  /** Número de página del cuento (solo kind = story). */
  number?: number;
  /** Armado en el libro (page-layout.ts): la página se ve igual que en el PDF. */
  layout?: { kind: 'facing' | 'calm' | 'vignette' | 'overlay'; side: 'top' | 'bottom' };
}

const STORY_FONT_CLASS: Record<StoryTypography['font'], string> = {
  quicksand: 'font-display font-bold',
  andika: 'font-[family-name:var(--font-story-reader)]',
  fraunces: 'font-[family-name:var(--font-story-serif)] font-medium',
};

/**
 * Clases del texto del cuento con la letra por edad (la misma del PDF, en escala de pantalla).
 * Sin tipografía (muestras anteriores), la de siempre.
 */
export function storyTextClass(typography: StoryTypography | null | undefined): string {
  if (!typography) return 'font-display text-lg leading-relaxed sm:text-xl';
  const size =
    typography.maxPt >= 30
      ? 'text-3xl leading-snug sm:text-4xl'
      : typography.maxPt >= 22
        ? 'text-2xl leading-snug sm:text-3xl'
        : typography.maxPt >= 18
          ? 'text-xl leading-normal sm:text-2xl'
          : typography.maxPt >= 15
            ? 'text-lg leading-relaxed sm:text-xl'
            : 'text-base leading-relaxed sm:text-lg';
  return cn(storyFontClass(typography), size);
}

/** Familia y mayúsculas de la letra por edad. */
export function storyFontClass(typography: StoryTypography): string {
  return cn(STORY_FONT_CLASS[typography.font], typography.uppercase && 'uppercase tracking-wide');
}

/**
 * Tamaño en la página del visor, proporcional al ancho como en el PDF (la misma escala que el
 * armado por edad: 15,5 pt ≈ 3,9 % del ancho).
 */
export function storyFontSize(typography: StoryTypography): string {
  const cqw = (typography.maxPt * 0.25).toFixed(2);
  const max = (typography.maxPt / 13).toFixed(2);
  return `clamp(0.8rem, ${cqw}cqw, ${max}rem)`;
}

/**
 * Ilustraciones de ejemplo para las páginas todavía sin ilustrar (no cuestan nada: son
 * imágenes fijas de la historia y del estilo, con otro protagonista).
 */
export interface ViewerExamples {
  cover: string | null;
  /** Páginas de ejemplo del estilo: cada página sin ilustrar muestra una distinta (en rueda). */
  pages: readonly string[];
  /** Rótulo sobre el ejemplo ("Ejemplo del estilo · el protagonista será Luci"). */
  label: string;
}

/**
 * Visor del libro tipo "Echar un vistazo": todas las páginas en un carrusel, con flechas,
 * teclado, deslizamiento en el celular y miniaturas. Las páginas sin ilustración muestran su
 * texto real y el lugar de la ilustración pendiente.
 */
export function BookViewer({
  title,
  coverName,
  pages,
  imageAlt,
  lockedLabel,
  badge,
  actions,
  onPageChange,
  examples,
  typography,
}: {
  title: string;
  /** Nombre del protagonista: en la portada va grande, con letra a mano. */
  coverName?: string;
  pages: ViewerPage[];
  imageAlt: (page: ViewerPage) => string;
  /** Texto del lugar de una ilustración pendiente. */
  lockedLabel: string;
  /** Rótulo opcional sobre la página ("Ejemplo"). */
  badge?: string;
  /** Acciones de la página visible (editar texto, otra ilustración). */
  actions?: (page: ViewerPage) => ReactNode;
  onPageChange?: (page: ViewerPage) => void;
  examples?: ViewerExamples;
  /** Letra del cuento por edad (la del PDF); sin ella, la de siempre. */
  typography?: StoryTypography | null;
}) {
  const t = useTranslations('Viewer');
  const [index, setIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const thumbsRef = useRef<HTMLOListElement>(null);
  const current = pages[Math.min(index, pages.length - 1)];
  const total = pages.length;

  const go = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), total - 1);
    setIndex(clamped);
    const page = pages[clamped];
    if (page) onPageChange?.(page);
  };

  // La miniatura actual queda centrada en la tira. Solo se desplaza la tira: scrollIntoView
  // movía toda la página hasta el visor al cargar (en el celular, la ficha abría a la mitad).
  useEffect(() => {
    const strip = thumbsRef.current;
    const item = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !item) return;
    strip.scrollTo({
      left: item.offsetLeft - strip.clientWidth / 2 + item.clientWidth / 2,
      behavior: 'smooth',
    });
  }, [index]);

  if (!current) return null;

  const label = (page: ViewerPage) =>
    page.kind === 'cover'
      ? t('cover')
      : page.kind === 'dedication'
        ? t('dedication')
        : page.kind === 'end'
          ? t('end')
          : t('page', { number: page.number ?? 0 });

  return (
    <section
      aria-roledescription="carrusel"
      aria-label={t('label')}
      className="min-w-0 rounded-2xl bg-[#f4ede6] p-3 sm:p-5"
    >
      <div
        tabIndex={0}
        role="group"
        aria-roledescription="página"
        aria-label={`${label(current)} · ${t('counter', { current: index + 1, total })}`}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') go(index + 1);
          if (event.key === 'ArrowLeft') go(index - 1);
        }}
        onPointerDown={(event) => {
          touchStart.current = event.clientX;
        }}
        onPointerUp={(event) => {
          if (touchStart.current === null) return;
          const delta = event.clientX - touchStart.current;
          touchStart.current = null;
          if (Math.abs(delta) > 50) go(index + (delta < 0 ? 1 : -1));
        }}
        className="relative rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <PageSpread
          page={current}
          title={title}
          coverName={coverName}
          alt={imageAlt(current)}
          lockedLabel={lockedLabel}
          badge={badge}
          examples={examples}
          noDedication={t('noDedication')}
          theEnd={t('theEnd')}
          wordless={t('wordless')}
          typography={typography}
        />
        <button
          type="button"
          onClick={() => {
            go(index - 1);
          }}
          disabled={index === 0}
          aria-label={t('prev')}
          className="absolute top-1/2 left-1 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-card/90 shadow-md transition hover:bg-card disabled:opacity-0 sm:-left-3"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => {
            go(index + 1);
          }}
          disabled={index === total - 1}
          aria-label={t('next')}
          className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-card/90 shadow-md transition hover:bg-card disabled:opacity-0 sm:-right-3"
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm font-bold text-muted-foreground">
          {label(current)} · {t('counter', { current: index + 1, total })}
        </p>
        {actions?.(current)}
      </div>

      <nav aria-label={t('thumbnails')} className="mt-3">
        <ol ref={thumbsRef} className="relative flex gap-2 overflow-x-auto pb-2">
          {pages.map((page, position) => (
            <li key={page.key} className="shrink-0">
              <button
                type="button"
                aria-current={position === index ? 'page' : undefined}
                aria-label={label(page)}
                onClick={() => {
                  go(position);
                }}
                className={cn(
                  'grid h-16 w-12 place-items-center overflow-hidden rounded-md border-2 bg-card text-[0.65rem] font-bold text-muted-foreground transition',
                  position === index
                    ? 'border-primary'
                    : 'border-transparent hover:border-primary/40',
                )}
              >
                {page.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={page.imageUrl} alt="" className="size-full object-cover" />
                ) : (
                  <span aria-hidden="true">
                    {page.kind === 'story' ? page.number : page.kind === 'end' ? '✦' : '♡'}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </section>
  );
}

function exampleFor(page: ViewerPage, examples?: ViewerExamples) {
  const pages = examples?.pages ?? [];
  const src =
    page.kind === 'cover'
      ? examples?.cover
      : pages.length
        ? pages[((page.number ?? 1) - 1) % pages.length]
        : null;
  return examples && src ? { src, label: examples.label } : null;
}

function Illustration({
  src,
  alt,
  lockedLabel,
  example,
}: {
  src: string | null;
  alt: string;
  lockedLabel: string;
  example?: { src: string; label: string } | null;
}) {
  const [exampleFailed, setExampleFailed] = useState(false);
  if (!src && example && !exampleFailed) {
    // Sin ilustración todavía: un ejemplo del estilo, bien rotulado (no es su libro).
    return (
      <div className="relative size-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- imagen pública de ejemplo */}
        <img
          src={example.src}
          alt=""
          className="size-full object-cover opacity-80 saturate-[0.85]"
          draggable={false}
          onError={() => {
            setExampleFailed(true);
          }}
        />
        <span className="absolute inset-x-3 bottom-3 rounded-full bg-card/95 px-3 py-1.5 text-center text-xs font-bold text-primary shadow">
          {example.label}
        </span>
      </div>
    );
  }
  return src ? (
    // URL firmada de corta duración o imagen de ejemplo: no pasa por el optimizador.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="size-full object-cover" draggable={false} />
  ) : (
    <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_30%_25%,#f1ecfb,#e6ddf6_45%,#ffe3db)] p-6 text-center">
      <span className="grid justify-items-center gap-2 text-sm font-bold text-primary">
        <Lock className="size-6" aria-hidden="true" />
        {lockedLabel}
      </span>
    </div>
  );
}

function PageSpread({
  page,
  title,
  coverName,
  alt,
  lockedLabel,
  badge,
  examples,
  noDedication,
  theEnd,
  wordless,
  typography,
}: {
  page: ViewerPage;
  title: string;
  coverName?: string;
  alt: string;
  lockedLabel: string;
  badge?: string;
  examples?: ViewerExamples;
  noDedication: string;
  theEnd: string;
  wordless: string;
  typography?: StoryTypography | null;
}) {
  const paper =
    'flex min-h-[18rem] flex-col justify-center rounded-xl bg-[#fffaf5] p-6 shadow-[inset_0_0_0_1px_rgb(38_50_74/0.06)] sm:p-10';

  if (page.kind === 'cover') {
    return (
      <div className="[container-type:inline-size] relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-xl shadow-[0_17px_45px_rgb(80_52_84/0.18)]">
        <Illustration
          key={page.key}
          src={page.imageUrl}
          alt={alt}
          lockedLabel={lockedLabel}
          example={exampleFor(page, examples)}
        />
        {/* El título va en la capa tipográfica, nunca dentro de la ilustración: la misma letra a mano
            que el catálogo y el libro impreso, con una veladura suave para que se lea. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[38%] bg-gradient-to-b from-[#fffaf5]/90 via-[#fffaf5]/60 to-transparent"
        />
        <h3 className="contents">
          <CoverTitle {...splitCoverTitle(title, coverName ?? '')} />
        </h3>
        {badge && <Badge>{badge}</Badge>}
      </div>
    );
  }

  if (page.kind === 'dedication' || page.kind === 'end') {
    return (
      <div className={cn(paper, 'mx-auto aspect-[3/4] w-full max-w-sm items-center text-center')}>
        <p className="font-display text-xl leading-relaxed text-muted-foreground italic sm:text-2xl">
          {page.kind === 'end' ? theEnd : (page.text ?? noDedication)}
        </p>
      </div>
    );
  }

  const illustration = (
    <Illustration
      key={page.key}
      src={page.imageUrl}
      alt={alt}
      lockedLabel={lockedLabel}
      example={exampleFor(page, examples)}
    />
  );
  // Letra por edad, la del PDF: el tamaño en proporción al ancho de la página (como el libro).
  const text = typography ? (
    <p
      className={cn(storyFontClass(typography), 'leading-snug whitespace-pre-line')}
      style={{ fontSize: storyFontSize(typography) }}
    >
      {page.text}
    </p>
  ) : (
    <p className="font-display text-[clamp(0.8rem,3.9cqw,1.15rem)] leading-relaxed whitespace-pre-line">
      {page.text}
    </p>
  );
  const layout = page.layout;

  // Páginas enfrentadas (como el libro abierto): el texto a la izquierda, con un detalle de la
  // ilustración arriba, y la ilustración entera a la derecha.
  if (!layout || layout.kind === 'facing') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div className={cn(paper, '[container-type:inline-size] gap-5 md:order-1')}>
          {layout && (
            <div
              aria-hidden="true"
              className="mx-auto size-24 shrink-0 overflow-hidden rounded-full shadow-[0_0_0_4px_#fffaf5,0_0_0_5px_#d8c9b8] [&_img]:object-[50%_35%]"
            >
              {illustration}
            </div>
          )}
          {layout ? (
            text
          ) : (
            <p className={cn(storyTextClass(typography), 'whitespace-pre-line')}>{page.text}</p>
          )}
        </div>
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl md:order-2">
          {illustration}
          {badge && <Badge>{badge}</Badge>}
        </div>
      </div>
    );
  }

  // Una sola página, igual que en el PDF: texto en la zona calma, sobre el papel donde se funde la
  // ilustración o en el panel de siempre. Sin texto: solo la ilustración.
  const top = layout.side === 'top';
  const hasText = Boolean(page.text?.trim());
  return (
    <div className="[container-type:inline-size] relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-xl bg-[#fffaf3] shadow-[0_17px_45px_rgb(80_52_84/0.18)]">
      <div
        className={cn(
          'absolute inset-x-0',
          layout.kind === 'vignette' && hasText
            ? cn(
                'h-[70%]',
                top
                  ? 'bottom-0 [mask-image:linear-gradient(to_top,#000_70%,transparent)] [&_img]:object-bottom'
                  : 'top-0 [mask-image:linear-gradient(to_bottom,#000_70%,transparent)] [&_img]:object-top',
              )
            : 'inset-y-0',
        )}
      >
        {illustration}
      </div>
      {hasText && (
        <div
          className={cn(
            'absolute inset-x-[6%]',
            top ? 'top-[5%]' : 'bottom-[5%]',
            layout.kind === 'overlay' && 'rounded-2xl bg-[#fffaf3]/95 px-[5%] py-[4%]',
            layout.kind === 'calm' &&
              'rounded-[2rem] bg-[#fffaf3]/80 px-[4%] py-[3%] shadow-[0_0_24px_18px_rgb(255_250_243/0.8)]',
          )}
        >
          {text}
        </div>
      )}
      {!hasText && <span className="sr-only">{wordless}</span>}
      {/* El rótulo va del lado opuesto al texto. */}
      {badge && (
        <div className={cn(!top && '[&>span]:top-3 [&>span]:bottom-auto')}>
          <Badge>{badge}</Badge>
        </div>
      )}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="absolute bottom-3 left-3 rounded-full bg-card/90 px-3 py-1 text-xs font-bold tracking-wide text-primary uppercase">
      {children}
    </span>
  );
}
