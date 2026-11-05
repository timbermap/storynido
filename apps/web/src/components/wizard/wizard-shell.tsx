'use client';

import { Check, CloudOff, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import type { Channel } from '@storynido/shared';

import { cn } from '@/lib/utils';

import { LINE_TONE } from './drafts-list';

import { stageOf, stagesFor, type SaveState, type WizardStep } from './steps';

/** Armazón del creador: progreso, título del paso (recibe el foco), navegación y guardado. */
export function WizardShell({
  step: current,
  flow,
  reached,
  line,
  fresh,
  choice,
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
  step: WizardStep;
  flow: readonly WizardStep[];
  reached: number;
  line?: Channel;
  fresh?: boolean;
  choice?: { story: string | null; lesson: string | null };
  saveState: SaveState;
  title: string;
  subtitle?: string;
  children: ReactNode;
  error?: string | null;
  onBack?: () => void;
  onNext?: () => void;
  onJump: (step: WizardStep) => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  const t = useTranslations('Wizard');
  const tLines = useTranslations('Wizard.lines');
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Numeración y progreso sobre los pasos visibles para la línea del libro.
  const visible = flow;
  const total = visible.length;
  const position = visible.indexOf(current);
  // Etapas: lo que se ve arriba, en el orden del flujo de la línea; dentro de cada una, el
  // sub-paso visible (1 de 2).
  const stages = stagesFor(flow);
  // En Celebraciones, la etapa de la fiesta se llama «Celebración» (no «Aventura»).
  const stageName = (key: string) =>
    t(`stages.${key === 'adventure' && flow.includes('party') ? 'celebration' : key}`);
  const { stage } = stageOf(current);
  const stageIndex = stages.findIndex((item) => item.key === stage.key);
  const stageSteps = stage.steps.filter((step) => visible.includes(step));
  const progressLabel = t('stageProgress', {
    current: stageIndex + 1,
    total: stages.length,
    name: stageName(stage.key),
  });
  // Si el paso se llama igual que la etapa («Personaje · Personaje (2 de 2)»), no se repite.
  const sameName = t(`steps.${current}`) === stageName(stage.key);
  const subLabel =
    stageSteps.length > 1
      ? sameName
        ? t('subStepCount', {
            current: stageSteps.indexOf(current) + 1,
            total: stageSteps.length,
          })
        : t('subStep', {
            name: t(`steps.${current}`),
            current: stageSteps.indexOf(current) + 1,
            total: stageSteps.length,
          })
      : null;

  // Dónde se cambia lo elegido: Profesionales elige su cuento base junto con el objetivo.
  const choiceStep = flow.includes('story') ? 'story' : flow.includes('focus') ? 'focus' : null;

  // Al cambiar de paso, el foco va al título (lectores de pantalla y teclado), sin desplazar:
  // el paso nuevo ya aparece arriba.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [current]);
  const saving = saveState === 'saving';

  return (
    // Cada paso aparece con un fundido corto (sin animación si se pidió menos movimiento).
    <div className="wizard-step-in container-page max-w-3xl py-10">
      {line && (
        // Qué se está creando, siempre a la vista (cuento, kit o proyecto profesional).
        <p className="mb-4 flex flex-wrap items-center gap-2">
          <span
            className={cn('inline-block rounded-full px-3 py-1 text-xs font-bold', LINE_TONE[line])}
          >
            {tLines(line)}
          </span>
          {fresh && (
            // Antes del primer guardado se puede elegir otra línea.
            <Link
              href="/new"
              className="inline-flex min-h-9 items-center px-2 text-xs font-semibold text-primary underline-offset-4 hover:underline"
            >
              {t('changeLine')}
            </Link>
          )}
        </p>
      )}
      {choice && (choice.story !== null || choice.lesson !== null) && (
        // Lo que ya se eligió viaja a todos los pasos; «Cambiar» vuelve al paso si ya se pasó por él.
        <p className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          {choice.story && (
            <span className="rounded-full border bg-card px-3 py-1 font-semibold">
              {t('choiceStory', { name: choice.story })}
            </span>
          )}
          {choice.lesson && (
            <span className="rounded-full border bg-card px-3 py-1 font-semibold">
              {t('choiceLesson', { name: choice.lesson })}
            </span>
          )}
          {choiceStep &&
            flow.indexOf(choiceStep) <= reached &&
            current !== choiceStep &&
            current !== 'lesson' && (
              <button
                type="button"
                onClick={() => {
                  onJump(choiceStep);
                }}
                className="inline-flex min-h-9 items-center px-2 text-xs font-semibold text-primary underline-offset-4 hover:underline"
              >
                {t('choiceChange')}
              </button>
            )}
        </p>
      )}
      <div className="flex items-center justify-between gap-4 text-sm font-bold text-muted-foreground">
        <span>
          {progressLabel}
          {subLabel && (
            <span className="font-semibold">
              {sameName ? ' ' : ' · '}
              {subLabel}
            </span>
          )}
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
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={position + 1}
        aria-label={progressLabel}
      >
        <span
          className="block h-full rounded-full bg-action transition-all"
          style={{ width: `${String(((position + 1) / total) * 100)}%` }}
        />
      </div>

      <nav aria-label={t('title')} className="mt-4 hidden sm:block">
        <ol className="flex flex-wrap gap-2 text-xs font-semibold">
          {stages.map((item, index) => {
            // Cada etapa abre en su primer paso visible; se puede volver a lo ya recorrido.
            const first = item.steps.find((step) => visible.includes(step));
            if (!first) return null;
            const reachable = flow.indexOf(first) <= reached;
            const active = index === stageIndex;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  disabled={!reachable}
                  aria-current={active ? 'step' : undefined}
                  onClick={() => {
                    onJump(first);
                  }}
                  className={cn(
                    'rounded-full px-3 py-1 transition disabled:cursor-not-allowed',
                    active
                      ? 'border border-navy bg-navy text-white'
                      : reachable
                        ? 'border bg-card text-foreground hover:border-foreground/40'
                        : 'border border-transparent bg-muted text-muted-foreground',
                  )}
                >
                  {index + 1}. {stageName(item.key)}
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
          <Button
            size="lg"
            onClick={onNext}
            disabled={saving ? true : nextDisabled}
            aria-busy={saving || undefined}
          >
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
            {nextLabel ?? t('next')}
          </Button>
        )}
      </div>
    </div>
  );
}
