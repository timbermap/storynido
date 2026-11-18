'use client';

import {
  DEFAULT_GENERATION_TIMES,
  remainingMinutes,
  timeProgress,
  type GenerationKind,
  type GenerationTimes,
} from '@storynido/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Una sola consulta por pestaña: los tiempos cambian despacio. */
let cached: Promise<GenerationTimes> | null = null;

function loadTimes(): Promise<GenerationTimes> {
  cached ??= api('generationTimes')
    .then((response) => ({ ...DEFAULT_GENERATION_TIMES, ...response.times }))
    .catch(() => {
      cached = null;
      return DEFAULT_GENERATION_TIMES;
    });
  return cached;
}

/** Cuánto suele tardar cada generación (tiempos reales recientes; mientras carga, los de base). */
export function useGenerationTimes(): GenerationTimes {
  const [times, setTimes] = useState<GenerationTimes>(DEFAULT_GENERATION_TIMES);
  useEffect(() => {
    let active = true;
    void loadTimes().then((loaded) => {
      if (active) setTimes(loaded);
    });
    return () => {
      active = false;
    };
  }, []);
  return times;
}

/** Fecha de Firestore (Timestamp), Date, milisegundos o nada → milisegundos. */
export function millisOf(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object' && 'toMillis' in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

/** Reloj que avanza cada `everyMs` (para mover la barra sin pedir nada al servidor). */
function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, everyMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [everyMs]);
  return now;
}

/**
 * Barra de avance y tiempo estimado de una generación (DECISIONS 261). El estimado sale de lo que
 * tardaron las últimas de ese tipo; la barra llega al 90 % en el tiempo típico y después se acerca
 * despacio sin llegar al final (eso lo marca que termine). Nunca muestra segundos que corren.
 */
export function GenerationProgress({
  kinds,
  before = [],
  startedAt,
  compact = false,
  className,
}: {
  /** Uno o varios tipos seguidos (se suman sus tiempos). */
  kinds: GenerationKind | readonly GenerationKind[];
  /** Partes que ya terminaron (cuentan como hechas): la barra sigue donde quedó, sin volver. */
  before?: readonly GenerationKind[];
  startedAt?: unknown;
  /** Versión chica (botones de regenerar, tarjetas): barra fina y texto corto. */
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations('Generation');
  const times = useGenerationTimes();
  const [mountedAt] = useState(() => Date.now());
  const now = useNow(1000);
  const list = [...before, ...(typeof kinds === 'string' ? [kinds] : kinds)];
  const typical = list.reduce((sum, kind) => sum + times[kind].typicalSeconds, 0);
  const slow = list.reduce((sum, kind) => sum + times[kind].slowSeconds, 0);
  const done = before.reduce((sum, kind) => sum + times[kind].typicalSeconds, 0) * 1000;
  const since = millisOf(startedAt) ?? mountedAt;
  // Un reloj del celular adelantado no puede dejar la barra en negativo.
  const current = Math.max(0, now - since);
  const elapsed = done + current;
  const fraction = timeProgress(elapsed, typical);
  const minutes = remainingMinutes(elapsed, typical);
  const late = elapsed > slow * 1000;
  const totalMinutes = Math.max(1, Math.round(typical / 60));

  let text: string;
  if (late) text = t('late');
  else if (minutes === null) text = t('almost');
  else if (current < 5000 && before.length === 0) text = t('usually', { minutes: totalMinutes });
  else text = t('remaining', { minutes });

  return (
    <div className={cn('mx-auto grid w-full max-w-md gap-2', className)}>
      <ProgressBar fraction={fraction} label={t('label')} compact={compact} />
      <p
        className={cn(
          'text-center font-semibold text-muted-foreground',
          compact ? 'text-xs' : 'text-sm',
        )}
      >
        {text}
      </p>
    </div>
  );
}

/** Barra de avance accesible (role=progressbar), fina y con el mismo durazno que la barra del creador. */
export function ProgressBar({
  fraction,
  label,
  compact = false,
}: {
  fraction: number;
  label: string;
  compact?: boolean;
}) {
  const percent = Math.round(Math.min(Math.max(fraction, 0), 1) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn('w-full overflow-hidden rounded-full bg-border', compact ? 'h-1.5' : 'h-2.5')}
    >
      <div
        className="h-full rounded-full bg-action transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
        style={{ width: `${String(Math.max(percent, 3))}%` }}
      />
    </div>
  );
}
