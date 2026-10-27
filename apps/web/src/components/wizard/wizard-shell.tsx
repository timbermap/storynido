'use client';

import { Check, CloudOff, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { WIZARD_STEPS, type SaveState, type WizardStep } from './steps';

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
  const position = visible.indexOf(WIZARD_STEPS[stepIndex] ?? 'child');

  // Al cambiar de paso, el foco va al título (lectores de pantalla y teclado).
  useEffect(() => {
    headingRef.current?.focus();
  }, [stepIndex]);

  return (
    <div className="container-page max-w-3xl py-10">
      <div className="flex items-center justify-between gap-4 text-sm font-bold text-muted-foreground">
        <span>{t('progress', { current: position + 1, total })}</span>
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
        aria-label={t('progress', { current: position + 1, total })}
      >
        <span
          className="block h-full rounded-full bg-primary transition-all"
          style={{ width: `${String(((position + 1) / total) * 100)}%` }}
        />
      </div>

      <nav aria-label={t('title')} className="mt-4 hidden sm:block">
        <ol className="flex flex-wrap gap-2 text-xs font-extrabold">
          {visible.map((step, visibleIndex) => {
            const index = WIZARD_STEPS.indexOf(step);
            const reachable = index <= maxReached;
            return (
              <li key={step}>
                <button
                  type="button"
                  disabled={!reachable}
                  aria-current={index === stepIndex ? 'step' : undefined}
                  onClick={() => {
                    onJump(index);
                  }}
                  className={cn(
                    'rounded-full px-3 py-1 transition',
                    index === stepIndex
                      ? 'bg-primary text-primary-foreground'
                      : reachable
                        ? 'bg-secondary text-primary hover:bg-secondary/70'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {visibleIndex + 1}. {t(`steps.${step}`)}
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
          className="text-3xl leading-tight font-semibold outline-none sm:text-4xl"
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
