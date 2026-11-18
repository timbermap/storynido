'use client';

import type { GenerationKind } from '@storynido/shared';
import { BookOpen, Check, Lightbulb, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode, type Ref } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { GenerationProgress } from '@/components/ui/generation-progress';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export type WaitLine = 'families' | 'events' | 'professionals';

/** Consejos que se van turnando mientras se espera (lo que se puede hacer con la muestra). */
const TIPS: Record<WaitLine, readonly string[]> = {
  families: ['edit', 'redraw', 'free', 'reread', 'reuse'],
  events: ['edit', 'redraw', 'free', 'whatsapp', 'reuse'],
  professionals: ['edit', 'redraw', 'free', 'reusePro'],
};

/**
 * Pantalla de espera de la muestra (DECISIONS 270): el personaje (o su lugar, mientras se dibuja),
 * el título, una sola barra de avance, los pasos como línea de tiempo que no se puede tocar, lo que
 * viene después, un consejo que se turna y, abajo y sin caja, que se puede cerrar la pantalla.
 */
export function WaitScreen({
  headingRef,
  title,
  text,
  characterUrl,
  characterAlt,
  revealLabel,
  bookTitle,
  progress,
  steps,
  active,
  after,
  line,
  leave,
}: {
  headingRef: Ref<HTMLHeadingElement>;
  title: string;
  text: string;
  /** Lámina de este cuento, cuando ya está dibujada; antes, un lugar que «se está dibujando». */
  characterUrl: string | null;
  characterAlt: string;
  /** Texto chico sobre la lámina recién dibujada («Así quedó Lu en este cuento»). */
  revealLabel: string | null;
  /** Título del cuento, apenas se escribió. */
  bookTitle: string | null;
  progress: {
    kinds: GenerationKind | readonly GenerationKind[];
    before?: readonly GenerationKind[];
    startedAt?: unknown;
  };
  steps: string[];
  active: number;
  /** Lo que viene cuando termina (no es un paso de la espera: lo decide la persona). */
  after: string;
  line: WaitLine;
  leave: ReactNode;
}) {
  const t = useTranslations('Wizard.preview.wait');
  return (
    <div className="container-page max-w-3xl py-12 text-center sm:py-16">
      <CharacterSlot url={characterUrl} alt={characterAlt} drawingLabel={t('drawing')} />
      {revealLabel && characterUrl && (
        <p className="mt-3 text-sm font-semibold text-success">{revealLabel}</p>
      )}
      <div role="status" aria-live="polite">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-5 text-[clamp(1.8rem,4vw,2.6rem)] font-medium text-balance outline-none"
        >
          {title}
        </h1>
        {bookTitle && (
          <p className="mt-2 font-serif text-lg text-foreground italic">
            {t('bookTitle', { title: bookTitle })}
          </p>
        )}
      </div>
      <p className="mx-auto mt-3 max-w-xl text-lg text-balance text-muted-foreground">{text}</p>
      <GenerationProgress className="mt-7" {...progress} />
      <WaitTimeline labels={steps} active={active} />
      <p className="mx-auto mt-4 flex max-w-md items-center justify-center gap-2 text-sm text-muted-foreground">
        <BookOpen className="size-4 shrink-0" aria-hidden="true" />
        <span>{after}</span>
      </p>
      <WaitTips line={line} />
      <div className="mx-auto mt-10 grid max-w-xl justify-items-center gap-2 border-t pt-6">
        {leave}
      </div>
    </div>
  );
}

/** Bloque «Puedes cerrar esta pantalla»: texto y un enlace discreto, sin caja. */
export function LeaveNote({ title, text }: { title: string; text: ReactNode }) {
  const t = useTranslations('Wizard.preview');
  return (
    <>
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-balance text-muted-foreground">{text}</p>
      <Link
        href="/my-stories"
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-1')}
      >
        {t('leaveButton')}
      </Link>
    </>
  );
}

function CharacterSlot({
  url,
  alt,
  drawingLabel,
}: {
  url: string | null;
  alt: string;
  drawingLabel: string;
}) {
  return (
    <div className="relative mx-auto w-28">
      <div
        className={cn(
          'aspect-[3/4] overflow-hidden rounded-2xl border bg-card',
          !url && 'bg-peach/60',
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada de pocos minutos.
          <img
            src={url}
            alt={alt}
            className="size-full object-cover motion-safe:animate-in motion-safe:duration-700 motion-safe:fade-in"
          />
        ) : (
          <div className="grid size-full place-items-center p-3">
            <div className="grid justify-items-center gap-2 text-primary">
              <Sparkles
                className="size-8 motion-safe:animate-pulse"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <span className="text-xs leading-tight font-semibold">{drawingLabel}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Pasos de la espera: una línea de tiempo (no son botones). Hecho con tilde, el actual con un punto
 * que late y el texto en negrita, los que siguen apagados. En el celular va en columna.
 */
export function WaitTimeline({ labels, active }: { labels: string[]; active: number }) {
  return (
    <ol className="mx-auto mt-6 flex w-fit max-w-xl flex-col gap-3 text-left text-sm sm:w-full sm:flex-row sm:gap-0 sm:text-center">
      {labels.map((label, index) => {
        const state = index < active ? 'done' : index === active ? 'current' : 'next';
        return (
          <li
            key={index}
            aria-current={state === 'current' ? 'step' : undefined}
            className="relative flex items-center gap-3 sm:flex-1 sm:flex-col sm:gap-2"
          >
            {/* Tramo de la línea hacia el paso anterior (solo en pantallas anchas). */}
            {index > 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-[9px] right-1/2 hidden h-0.5 w-full sm:block',
                  index <= active ? 'bg-success/50' : 'bg-border',
                )}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                'relative z-10 grid size-5 shrink-0 place-items-center rounded-full',
                state === 'done' && 'bg-mint text-success',
                state === 'current' && 'bg-primary',
                state === 'next' && 'border-2 border-border bg-background',
              )}
            >
              {state === 'done' && <Check className="size-3" strokeWidth={3} />}
              {state === 'current' && (
                <>
                  <span className="absolute inset-0 rounded-full bg-primary/40 motion-safe:animate-ping" />
                  <span className="size-2 rounded-full bg-primary-foreground" />
                </>
              )}
            </span>
            <span
              className={cn(
                'leading-snug text-balance sm:px-2',
                state === 'current' && 'font-semibold text-foreground',
                state === 'done' && 'text-muted-foreground',
                state === 'next' && 'text-muted-foreground',
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Un consejo a la vez, que cambia cada 9 s (no se anuncia: no es parte del avance). */
function WaitTips({ line }: { line: WaitLine }) {
  const t = useTranslations('Wizard.preview.wait');
  const tips = TIPS[line];
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % tips.length);
    }, 9000);
    return () => {
      window.clearInterval(timer);
    };
  }, [tips.length]);
  const tip = tips[index] ?? tips[0] ?? 'edit';
  return (
    <div
      aria-live="off"
      className="mx-auto mt-8 flex max-w-md items-start gap-3 rounded-2xl bg-sky/40 px-4 py-3 text-left"
    >
      <Lightbulb className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <p className="text-sm">
        <span className="font-semibold">{t('tipLabel')} </span>
        <span
          key={tip}
          className="motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in"
        >
          {t(`tips.${tip}`)}
        </span>
      </p>
    </div>
  );
}
