'use client';

import { Check, CloudOff, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { WIZARD_STAGES, WIZARD_STEPS, stageOf, type SaveState, type WizardStep } from './steps';

/** Armazón del creador: progreso, título del paso (recibe el foco), navegación y guardado. */
export function WizardShell({
  stepIndex,
  hidden,
  maxReached,
  saveState,
  title,
  subtitle,
  children,
  error,
  onBack,
  onNext,
  onJump,
  nextLabel,
  nextDisabled,
}: {
  stepIndex: number;
  hidden: readonly WizardStep[];
  maxReached: number;
  saveState: SaveState;
  title: string;
  subtitle?: string;
  children: ReactNode;
  error?: string | null;
  onBack?: () => void;
  onNext?: () => void;
  onJump: (index: number) => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  const t = useTranslations('Wizard');
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Numeración y progreso sobre los pasos visibles para la línea del libro.
  const visible = WIZARD_STEPS.filter((step) => !hidden.includes(step));
  const total = visible.length;
  const current = WIZARD_STEPS[stepIndex] ?? 'child';
  const position = visible.indexOf(current);
  // Etapas: lo que se ve arriba. Dentro de "La aventura", el sub-paso visible (2 de 4).
  const { index: stageIndex, stage } = stageOf(current);
  const stageSteps = stage.steps.filter((step) => visible.includes(step));
  const progressLabel = t('stageProgress', {
    current: stageIndex + 1,
    total: WIZARD_STAGES.length,
    name: t(`stages.${stage.key}`),
  });
  const subLabel =
    stageSteps.length > 1
      ? t('subStep', {
          name: t(`steps.${current}`),
          current: stageSteps.indexOf(current) + 1,
          total: stageSteps.length,
        })
      : null;

  // Al cambiar de paso, el foco va al título (lectores de pantalla y teclado).
  useEffect(() => {
    headingRef.current?.focus();
  }, [stepIndex]);

  return (
    <div className="container-page max-w-3xl py-10">
      <div className="flex items-center justify-between gap-4 text-sm font-bold text-muted-foreground">
        <span>
          {progressLabel}
          {subLabel && <span className="font-semibold"> · {subLabel}</span>}
        </span>
        <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5">
          {saveState === 'saving' && (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t('saving')}
            </>
          )}
          {saveState === 'saved' && (
            <>
              <Check className="size-4 text-success" aria-hidden="true" />
              {t('saved')}
            </>
          )}
          {saveState === 'error' && (
            <>
              <CloudOff className="size-4 text-red-800" aria-hidden="true" />
              {t('saveError')}
            </>
          )}
        </span>
      </div>

      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={position + 1}
        aria-label={progressLabel}
      >
        <span
          className="block h-full rounded-full bg-primary transition-all"
          style={{ width: `${String(((position + 1) / total) * 100)}%` }}
        />
      </div>

      <nav aria-label={t('title')} className="mt-4 hidden sm:block">
        <ol className="flex flex-wrap gap-2 text-xs font-semibold">
          {WIZARD_STAGES.map((item, index) => {
            // Cada etapa abre en su primer paso visible; se puede volver a lo ya recorrido.
            const first = item.steps.find((step) => visible.includes(step));
            if (!first) return null;
            const target = WIZARD_STEPS.indexOf(first);
            const reachable = target <= maxReached;
            const active = index === stageIndex;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  disabled={!reachable}
                  aria-current={active ? 'step' : undefined}
                  onClick={() => {
                    onJump(target);
                  }}
                  className={cn(
                    'rounded-full px-3 py-1 transition',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : reachable
                        ? 'bg-secondary text-primary hover:bg-secondary/70'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {index + 1}. {t(`stages.${item.key}`)}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="mt-8 rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl leading-tight font-medium outline-none sm:text-4xl"
        >
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {error && (
          <p role="alert" className="mt-6 text-sm font-bold text-red-800">
            {error}
          </p>
        )}
      </section>

      <div className="mt-6 flex items-center justify-between gap-3">
        {onBack ? (
          <Button variant="ghost" onClick={onBack}>
            {t('back')}
          </Button>
        ) : (
          <span />
        )}
        {onNext && (
          <Button size="lg" onClick={onNext} disabled={nextDisabled}>
            {nextLabel ?? t('next')}
          </Button>
        )}
      </div>
    </div>
  );
}
