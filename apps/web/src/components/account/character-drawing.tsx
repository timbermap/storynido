'use client';

import {
  ApiError,
  MUST_KEEP_TRAITS,
  type CharacterDrawing as Drawing,
  type MustKeepTrait,
} from '@storynido/shared';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const KNOWN_ERRORS = [
  'limit_reached',
  'limit_reached_week',
  'ai_budget_exhausted',
  'validation_failed',
];

/**
 * El dibujo del personaje en su perfil: crearlo o actualizarlo con sus fotos vigentes (o sus
 * rasgos), ver el actual y el nuevo lado a lado y elegir. Cada dibujo nuevo usa una generación.
 */
export function CharacterDrawing({
  childId,
  name,
  currentUrl,
  drawing,
  startSignal = 0,
  onChange,
}: {
  childId: string;
  name: string;
  currentUrl: string | null;
  drawing: Drawing;
  /** Cada vez que sube, se pide un dibujo nuevo (el botón del recuadro del retrato). */
  startSignal?: number;
  onChange: (next: { imageUrl: string | null; drawing: Drawing }) => void;
}) {
  const t = useTranslations('Account.myStories.drawing');
  const tPreview = useTranslations('Wizard.preview');
  const [busy, setBusy] = useState<'draw' | 'accept' | 'discard' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [aspects, setAspects] = useState<MustKeepTrait[]>([]);
  const [note, setNote] = useState('');

  async function run(kind: 'draw' | 'accept' | 'discard', call: () => ReturnType<typeof draw>) {
    setBusy(kind);
    setError(null);
    try {
      const { imageUrl, ...next } = await call();
      onChange({ imageUrl, drawing: next });
      setAdjusting(false);
      setAspects([]);
      setNote('');
    } catch (caught) {
      setError(
        caught instanceof ApiError && KNOWN_ERRORS.includes(caught.code)
          ? tPreview(`errors.${caught.code}`)
          : t('error'),
      );
    } finally {
      setBusy(null);
    }
  }

  const draw = (body: { mustKeep?: MustKeepTrait[]; note?: string | null } = {}) =>
    api('generateChildDrawing', { params: { childId }, body });

  const requested = useRef(startSignal);
  useEffect(() => {
    if (startSignal === requested.current) return;
    requested.current = startSignal;
    void run('draw', () => draw());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSignal]);

  if (!drawing.canDraw && !drawing.candidateUrl) return null;

  return (
    <section
      aria-labelledby="character-drawing"
      className="grid gap-4 rounded-2xl border bg-card p-5"
    >
      <h2 id="character-drawing" className="text-xl font-medium">
        {currentUrl ? t('updateTitle', { name }) : t('createTitle', { name })}
      </h2>

      {busy === 'draw' && (
        <p role="status" className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t('drawing', { name })}
        </p>
      )}

      {drawing.candidateUrl ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:max-w-md">
            <figure className="grid gap-1.5">
              <div className="aspect-[3/4] overflow-hidden rounded-xl border bg-muted">
                {currentUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL firmada de 30 min.
                  <img
                    src={currentUrl}
                    alt={t('currentAlt', { name })}
                    className="size-full object-cover"
                  />
                ) : (
                  <p className="grid size-full place-items-center p-3 text-center text-sm text-muted-foreground">
                    {t('noCurrent')}
                  </p>
                )}
              </div>
              <figcaption className="text-sm font-semibold">{t('current')}</figcaption>
            </figure>
            <figure className="grid gap-1.5">
              <div className="aspect-[3/4] overflow-hidden rounded-xl border-2 border-navy bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada de 30 min. */}
                <img
                  src={drawing.candidateUrl}
                  alt={t('newAlt', { name })}
                  className="size-full object-cover"
                />
              </div>
              <figcaption className="text-sm font-semibold">{t('new')}</figcaption>
            </figure>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy !== null}
              onClick={() =>
                void run('accept', () => api('acceptChildDrawing', { params: { childId } }))
              }
            >
              {busy === 'accept' && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t('use')}
            </Button>
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() =>
                void run('discard', () => api('discardChildDrawing', { params: { childId } }))
              }
            >
              {t('keep')}
            </Button>
            <Button
              variant="ghost"
              disabled={busy !== null}
              onClick={() => {
                setAdjusting((open) => !open);
              }}
            >
              {tPreview('correct')}
            </Button>
          </div>
        </>
      ) : (
        <div className="grid gap-1.5">
          <Button
            className="w-fit"
            disabled={busy !== null}
            onClick={() => void run('draw', () => draw())}
          >
            {currentUrl ? t('update') : t('create')}
          </Button>
          <p className="text-sm text-muted-foreground">{t('note')}</p>
        </div>
      )}

      {adjusting && (
        <div className="grid gap-4 rounded-xl bg-muted/50 p-4">
          <fieldset>
            <legend className="font-bold">{tPreview('whatsOff')}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {MUST_KEEP_TRAITS.map((trait) => {
                const checked = aspects.includes(trait);
                return (
                  <label
                    key={trait}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-2 rounded-full border-2 bg-card px-4 text-sm font-bold',
                      checked ? 'border-navy' : 'border-border',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--primary)]"
                      checked={checked}
                      onChange={(event) => {
                        setAspects((current) =>
                          event.target.checked
                            ? [...current, trait]
                            : current.filter((item) => item !== trait),
                        );
                      }}
                    />
                    {tPreview(`aspects.${trait}`)}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="grid gap-2">
            <label htmlFor="drawing-note" className="font-bold">
              {tPreview('adjustNote')}
            </label>
            <input
              id="drawing-note"
              value={note}
              maxLength={120}
              placeholder={tPreview('adjustNotePlaceholder')}
              onChange={(event) => {
                setNote(event.target.value);
              }}
              className="h-11 rounded-lg border bg-card px-3"
            />
          </div>
          <Button
            className="w-fit"
            disabled={busy !== null || (aspects.length === 0 && !note.trim())}
            onClick={() =>
              void run('draw', () => draw({ mustKeep: aspects, note: note.trim() || null }))
            }
          >
            {t('redrawAdjusted')}
          </Button>
          <p className="text-sm text-muted-foreground">{t('note')}</p>
        </div>
      )}

      {error && (
        <p role="alert" className="font-semibold text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
