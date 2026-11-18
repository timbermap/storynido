'use client';

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize,
  Minimize,
  RotateCcw,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import {
  fitPageHeight,
  readerSpreads,
  savePage,
  savedPage,
  spreadIndexOf,
  wantsSpread,
} from '@/lib/reader';
import { cn } from '@/lib/utils';

/** Un solo worker de pdf.js para toda la visita (se crea al abrir el primer cuento). */
let pdfWorker: Worker | null = null;

async function openPdf(data: ArrayBuffer) {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfWorker) {
    pdfWorker = new Worker(new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url), {
      type: 'module',
    });
    pdfjs.GlobalWorkerOptions.workerPort = pdfWorker;
  }
  // Los PDF del pipeline traen sus fuentes y no usan JPEG 2000: sin wasm.
  const task = pdfjs.getDocument({ data, useWasm: false });
  return { task, doc: await task.promise };
}

/** Pantalla completa del navegador (en iPhone no existe). */
const subscribeFullscreen = (onChange: () => void) => {
  document.addEventListener('fullscreenchange', onChange);
  return () => {
    document.removeEventListener('fullscreenchange', onChange);
  };
};
const noSubscription = () => () => undefined;

/** Hasta 2x de densidad: más no se nota en la pantalla y pesa el doble. */
const pixelRatio = () => Math.min(2, Math.max(1, window.devicePixelRatio || 1));

type Phase =
  | { kind: 'loading'; percent: number | null }
  | { kind: 'failed' }
  | { kind: 'ready'; doc: PDFDocumentProxy; aspect: number; title: string | null };

export interface StoryReaderProps {
  /** Baja el PDF del libro; `onProgress` recibe de 0 a 1 si se conoce el tamaño. */
  load: (onProgress: (fraction: number) => void) => Promise<ArrayBuffer>;
  /** Para recordar en qué página quedó (solo en este navegador). */
  storageKey: string;
  /** Título del libro si ya se conoce (si no, el del PDF). */
  title?: string | null;
  onDownload?: () => void;
  downloading?: boolean;
  /** Algo para mostrar en vez del libro (no está listo, falta la sesión). */
  blocked?: ReactNode;
  /** A dónde lleva la X (por defecto, Terminados de Mis cuentos). */
  closeHref?: ComponentProps<typeof Link>['href'];
}

/**
 * El visor de cuentos (DECISIONS 254): el PDF limpio del libro comprado, página por página, a
 * pantalla completa. En el celular, una página por vez (deslizar o tocar los costados); en una
 * pantalla ancha, a doble página como un libro abierto. Recuerda la página y termina con «Fin».
 */
export function StoryReader({
  load,
  storageKey,
  title: knownTitle,
  onDownload,
  downloading = false,
  blocked,
  closeHref = { pathname: '/my-stories', query: { estado: 'terminados' } },
}: StoryReaderProps) {
  const t = useTranslations('Reader');
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading', percent: null });
  const [attempt, setAttempt] = useState(0);
  const [box, setBox] = useState({ width: 0, height: 0 });
  /** Primera página del grupo que se ve (no el índice: así no se pierde al girar). */
  const [page, setPage] = useState(1);
  const [ended, setEnded] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [resumed, setResumed] = useState<number | null>(null);
  const fullscreen = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenElement !== null,
    () => false,
  );
  const canFullscreen = useSyncExternalStore(
    noSubscription,
    () => document.fullscreenEnabled,
    () => false,
  );
  const [images, setImages] = useState<Record<string, string>>({});
  const urls = useRef(new Map<string, string>());

  // Baja y abre el PDF (otra vez con «Intentar de nuevo»).
  useEffect(() => {
    if (blocked) return;
    let cancelled = false;
    let opened: { destroy: () => Promise<void> } | null = null;
    void load((fraction) => {
      if (!cancelled) setPhase({ kind: 'loading', percent: Math.round(fraction * 100) });
    })
      .then(openPdf)
      .then(async ({ task, doc }) => {
        opened = task;
        const [first, meta] = await Promise.all([
          doc.getPage(1),
          doc.getMetadata().catch(() => null),
        ]);
        if (cancelled) return;
        const viewport = first.getViewport({ scale: 1 });
        const info = meta?.info as { Title?: unknown } | undefined;
        const pdfTitle = typeof info?.Title === 'string' && info.Title.trim() ? info.Title : null;
        const start = savedPage(storageKey, doc.numPages);
        if (start) {
          setPage(start);
          setResumed(start);
        }
        setPhase({ kind: 'ready', doc, aspect: viewport.width / viewport.height, title: pdfTitle });
      })
      .catch(() => {
        if (!cancelled) setPhase({ kind: 'failed' });
      });
    return () => {
      cancelled = true;
      void opened?.destroy();
    };
  }, [load, storageKey, attempt, blocked]);

  // Las imágenes de las páginas se liberan al cerrar.
  useEffect(() => {
    const cache = urls.current;
    return () => {
      for (const url of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
    };
  }, []);

  // El tamaño disponible para el libro (cambia al girar o al pasar a pantalla completa).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setBox({ width: Math.floor(width), height: Math.floor(height) });
    });
    observer.observe(stage);
    return () => {
      observer.disconnect();
    };
  }, [phase.kind]);

  // Sin scroll de la página de atrás mientras se lee.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const ready = phase.kind === 'ready' ? phase : null;
  const total = ready?.doc.numPages ?? 0;
  const spread = ready ? wantsSpread(box, ready.aspect) : false;
  const spreads = useMemo(() => readerSpreads(total, spread), [total, spread]);
  const index = spreadIndexOf(spreads, page);
  const current = spreads[index] ?? [];
  const pageHeight = ready ? fitPageHeight(box, ready.aspect, current.length || 1) : 0;
  const pageWidth = ready ? Math.floor(pageHeight * ready.aspect) : 0;
  const sizeKey = pageHeight > 0 ? Math.round(pageHeight * pixelRatio()) : 0;

  // Dibuja las páginas que se ven y, después, las de al lado (pasar de página es instantáneo).
  useEffect(() => {
    if (!ready || sizeKey === 0) return;
    const run = { cancelled: false };
    // Una función: después de cada await hay que volver a mirar si se canceló.
    const stopped = () => run.cancelled;
    const wanted = [
      ...current,
      ...(spreads[index + 1] ?? []),
      ...(spreads[index - 1] ?? []),
      ...(spreads[index + 2] ?? []),
    ];
    void (async () => {
      for (const number of wanted) {
        const key = `${String(number)}@${String(sizeKey)}`;
        if (stopped()) return;
        if (urls.current.has(key)) continue;
        try {
          const pdfPage = await ready.doc.getPage(number);
          const base = pdfPage.getViewport({ scale: 1 });
          const viewport = pdfPage.getViewport({ scale: sizeKey / base.height });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          await pdfPage.render({ canvas, viewport }).promise;
          const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, 'image/jpeg', 0.9);
          });
          if (!blob || stopped()) continue;
          const url = URL.createObjectURL(blob);
          urls.current.set(key, url);
          setImages((shown) => ({ ...shown, [key]: url }));
        } catch {
          // Una página que no se pudo dibujar queda en blanco; las demás siguen.
        }
      }
    })();
    return () => {
      run.cancelled = true;
    };
    // `current` y `spreads` cambian con `index`, `total` y `spread`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sizeKey, index, total, spread]);

  // Guarda dónde quedó.
  useEffect(() => {
    if (ready) savePage(storageKey, page);
  }, [ready, page, storageKey]);

  const go = useCallback(
    (step: 1 | -1) => {
      if (!ready) return;
      setResumed(null);
      setDirection(step);
      if (ended) {
        if (step === -1) setEnded(false);
        return;
      }
      const next = spreads[index + step];
      if (next?.[0] !== undefined) setPage(next[0]);
      else if (step === 1) setEnded(true);
    },
    [ready, ended, spreads, index],
  );

  const restart = useCallback(() => {
    setResumed(null);
    setEnded(false);
    setDirection(-1);
    setPage(1);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen().catch(() => undefined);
  }, []);

  // Teclado: flechas, espacio, Inicio y Fin (la compu o una tablet con teclado).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea')) return;
      if (['ArrowRight', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault();
        go(1);
      } else if (['ArrowLeft', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        go(-1);
      } else if (event.key === 'Home') {
        restart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [go, restart]);

  // Deslizar para pasar de página; un toque en el tercio izquierdo vuelve, en el resto avanza.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (event: React.PointerEvent) => {
    swipe.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || ended) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      go(dx < 0 ? 1 : -1);
      return;
    }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const rect = event.currentTarget.getBoundingClientRect();
      go(event.clientX < rect.left + rect.width / 3 ? -1 : 1);
    }
  };

  const title = knownTitle ?? ready?.title ?? t('fallbackTitle');
  const first = current[0] ?? 1;
  const last = current[current.length - 1] ?? first;
  const position = ended
    ? t('end.title')
    : current.length > 1
      ? t('pages', { from: first, to: last, total })
      : t('page', { page: first, total });
  const progress = total > 0 ? (ended ? 1 : last / total) : 0;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('label', { title })}
      className="fixed inset-0 z-[70] flex flex-col bg-[#1E2638] text-white"
    >
      {/* Arriba: cerrar, el título y las herramientas. */}
      <header className="flex items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1 sm:px-4">
        <Link
          href={closeHref}
          aria-label={t('close')}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'icon' }),
            'text-white hover:bg-white/10',
          )}
        >
          <X aria-hidden="true" className="size-5" />
        </Link>
        <p className="min-w-0 flex-1 truncate font-serif text-base font-semibold sm:text-lg">
          {title}
        </p>
        {onDownload && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('download')}
            title={t('download')}
            disabled={downloading}
            onClick={onDownload}
            className="text-white hover:bg-white/10"
          >
            {downloading ? (
              <Loader2 aria-hidden="true" className="size-5 animate-spin" />
            ) : (
              <Download aria-hidden="true" className="size-5" />
            )}
          </Button>
        )}
        {canFullscreen && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={fullscreen ? t('exitFullscreen') : t('fullscreen')}
            title={fullscreen ? t('exitFullscreen') : t('fullscreen')}
            onClick={toggleFullscreen}
            className="text-white hover:bg-white/10"
          >
            {fullscreen ? (
              <Minimize aria-hidden="true" className="size-5" />
            ) : (
              <Maximize aria-hidden="true" className="size-5" />
            )}
          </Button>
        )}
      </header>

      {/* El libro. */}
      <div className="relative flex min-h-0 flex-1 items-center gap-1 px-1 sm:gap-3 sm:px-3">
        {ready && !ended && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('prev')}
            disabled={index === 0}
            onClick={() => {
              go(-1);
            }}
            className="hidden text-white hover:bg-white/10 disabled:opacity-30 sm:inline-flex"
          >
            <ChevronLeft aria-hidden="true" className="size-7" />
          </Button>
        )}
        <div
          ref={stageRef}
          className="flex h-full min-w-0 flex-1 touch-pan-y items-center justify-center py-2 select-none"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          {blocked ? (
            <div className="max-w-sm rounded-2xl bg-card p-6 text-center text-foreground">
              {blocked}
            </div>
          ) : phase.kind === 'loading' ? (
            <p role="status" className="flex flex-col items-center gap-3 text-white/80">
              <Loader2 aria-hidden="true" className="size-8 animate-spin" />
              {phase.percent !== null
                ? t('openingPercent', { percent: phase.percent })
                : t('opening')}
            </p>
          ) : phase.kind === 'failed' ? (
            <div
              role="alert"
              className="grid max-w-sm gap-4 rounded-2xl bg-card p-6 text-center text-foreground"
            >
              <p>{t('failed')}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  onClick={() => {
                    setPhase({ kind: 'loading', percent: null });
                    setAttempt((count) => count + 1);
                  }}
                >
                  {t('retry')}
                </Button>
                {onDownload && (
                  <Button variant="outline" onClick={onDownload} disabled={downloading}>
                    {t('download')}
                  </Button>
                )}
              </div>
            </div>
          ) : ended ? (
            <EndCard onRestart={restart} onDownload={onDownload} downloading={downloading} />
          ) : (
            <div
              key={`${String(first)}-${spread ? 's' : '1'}`}
              className={cn(
                'flex items-center justify-center motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in-0',
                direction === 1
                  ? 'motion-safe:slide-in-from-right-6'
                  : 'motion-safe:slide-in-from-left-6',
              )}
            >
              {current.map((number, position) => {
                const src = images[`${String(number)}@${String(sizeKey)}`];
                const single = current.length === 1;
                return (
                  <div
                    key={number}
                    style={{ width: pageWidth, height: pageHeight }}
                    className={cn(
                      'relative overflow-hidden bg-white shadow-[0_18px_40px_-18px_rgb(0_0_0/0.7)]',
                      single
                        ? 'rounded-md'
                        : position === 0
                          ? 'rounded-l-md after:absolute after:inset-y-0 after:right-0 after:w-6 after:bg-gradient-to-l after:from-black/15 after:to-transparent'
                          : 'rounded-r-md after:absolute after:inset-y-0 after:left-0 after:w-6 after:bg-gradient-to-r after:from-black/15 after:to-transparent',
                    )}
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element -- imagen local del PDF (blob:)
                      <img
                        src={src}
                        alt={t('pageAlt', { page: number, total })}
                        draggable={false}
                        className="size-full"
                      />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center text-navy/40">
                        <Loader2 aria-hidden="true" className="size-6 animate-spin" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {ready && !ended && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('next')}
            onClick={() => {
              go(1);
            }}
            className="hidden text-white hover:bg-white/10 sm:inline-flex"
          >
            <ChevronRight aria-hidden="true" className="size-7" />
          </Button>
        )}
      </div>

      {/* Abajo: dónde va, la barra de avance y, en el celular, los botones grandes. */}
      {ready && (
        <footer className="grid gap-2 px-4 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {resumed !== null && !ended && (
            <p className="flex flex-wrap items-center justify-center gap-x-3 text-sm text-white/85">
              {t('resumed', { page: resumed })}
              <button
                type="button"
                onClick={restart}
                className="min-h-10 font-bold text-[#FFB6A7] underline-offset-4 hover:underline"
              >
                {t('fromStart')}
              </button>
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('prev')}
              disabled={index === 0 && !ended}
              onClick={() => {
                go(-1);
              }}
              className="text-white hover:bg-white/10 disabled:opacity-30 sm:hidden"
            >
              <ChevronLeft aria-hidden="true" className="size-6" />
            </Button>
            <div className="grid flex-1 gap-1.5">
              <p
                aria-live="polite"
                className="text-center font-sans text-sm text-white/85 tabular-nums"
              >
                {position}
              </p>
              <div
                className="h-1 overflow-hidden rounded-full bg-white/15"
                role="progressbar"
                aria-label={t('progress')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
              >
                <div
                  className="h-full rounded-full bg-[#FFB6A7] transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${String(progress * 100)}%` }}
                />
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('next')}
              disabled={ended}
              onClick={() => {
                go(1);
              }}
              className="text-white hover:bg-white/10 disabled:opacity-30 sm:hidden"
            >
              <ChevronRight aria-hidden="true" className="size-6" />
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}

/** El final del libro: leerlo otra vez, crear el próximo o descargarlo. */
function EndCard({
  onRestart,
  onDownload,
  downloading,
}: {
  onRestart: () => void;
  onDownload?: () => void;
  downloading: boolean;
}) {
  const t = useTranslations('Reader.end');
  const tReader = useTranslations('Reader');
  return (
    <div className="grid max-w-sm gap-5 rounded-2xl bg-card p-7 text-center text-foreground motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95">
      <p className="font-script text-5xl leading-none text-primary">{t('title')}</p>
      <p className="text-muted-foreground">{t('text')}</p>
      <div className="grid gap-2">
        <Link href="/new" data-track="lector-crear-otro" className={buttonVariants()}>
          {t('create')}
        </Link>
        <Button variant="outline" onClick={onRestart}>
          <RotateCcw aria-hidden="true" />
          {t('again')}
        </Button>
        {onDownload && (
          <Button variant="ghost" onClick={onDownload} disabled={downloading}>
            <Download aria-hidden="true" />
            {tReader('download')}
          </Button>
        )}
      </div>
    </div>
  );
}
