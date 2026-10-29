'use client';

import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface ViewerPage {
  key: string;
  kind: 'cover' | 'dedication' | 'story' | 'end';
  /** Ilustración (URL firmada con marca de agua o imagen pública de ejemplo). */
  imageUrl: string | null;
  text: string | null;
  /** Número de página del cuento (solo kind = story). */
  number?: number;
}

/**
 * Ilustraciones de ejemplo para las páginas todavía sin ilustrar (no cuestan nada: son
 * imágenes fijas de la historia y del estilo, con otro protagonista).
 */
export interface ViewerExamples {
  cover: string | null;
  page: string | null;
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
  pages,
  imageAlt,
  lockedLabel,
  badge,
  actions,
  onPageChange,
  examples,
}: {
  title: string;
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

  // La miniatura actual queda a la vista en la tira.
  useEffect(() => {
    thumbsRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
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
          alt={imageAlt(current)}
          lockedLabel={lockedLabel}
          badge={badge}
          examples={examples}
          noDedication={t('noDedication')}
          theEnd={t('theEnd')}
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
        <ol ref={thumbsRef} className="flex gap-2 overflow-x-auto pb-2">
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
  const src = page.kind === 'cover' ? examples?.cover : examples?.page;
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
    <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_30%_25%,#f3e9f9,#eadcf2_45%,#f5d9c9)] p-6 text-center">
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
  alt,
  lockedLabel,
  badge,
  examples,
  noDedication,
  theEnd,
}: {
  page: ViewerPage;
  title: string;
  alt: string;
  lockedLabel: string;
  badge?: string;
  examples?: ViewerExamples;
  noDedication: string;
  theEnd: string;
}) {
  const paper =
    'flex min-h-[18rem] flex-col justify-center rounded-xl bg-[#fffaf4] p-6 shadow-[inset_0_0_0_1px_rgb(52_42_64/0.06)] sm:p-10';

  if (page.kind === 'cover') {
    return (
      <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-xl shadow-[0_17px_45px_rgb(80_52_84/0.18)]">
        <Illustration
          key={page.key}
          src={page.imageUrl}
          alt={alt}
          lockedLabel={lockedLabel}
          example={exampleFor(page, examples)}
        />
        {/* El título va en la capa tipográfica, nunca dentro de la ilustración. */}
        <h3 className="absolute inset-x-0 top-0 bg-gradient-to-b from-[#fffaf4]/95 to-transparent px-6 pt-6 pb-10 text-center font-display text-2xl leading-tight font-medium sm:text-3xl">
          {title}
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

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl">
        <Illustration
          key={page.key}
          src={page.imageUrl}
          alt={alt}
          lockedLabel={lockedLabel}
          example={exampleFor(page, examples)}
        />
        {badge && <Badge>{badge}</Badge>}
      </div>
      <div className={paper}>
        <p className="font-display text-lg leading-relaxed whitespace-pre-line sm:text-xl">
          {page.text}
        </p>
      </div>
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
