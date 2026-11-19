'use client';

import {
  ApiError,
  MUST_KEEP_TRAITS,
  type AvatarTrait,
  type CharacterDrawing as Drawing,
  type CharacterTraits,
  type MustKeepTrait,
} from '@storynido/shared';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { GenerationProgress } from '@/components/ui/generation-progress';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

import { AVATAR_TRAITS, TraitPicker, type TraitDraft } from '../wizard/trait-picker';

/** Qué rasgos cambia cada cosa que «no se parece» (igual que en la muestra). */
const ASPECT_TRAITS: Partial<Record<MustKeepTrait, readonly AvatarTrait[]>> = {
  hair: ['hairColor', 'hairLength', 'hairType'],
  skinTone: ['skinTone'],
  eyeColor: ['eyeColor'],
};

/**
 * El dibujo no pasó el control de calidad en ningún intento: casi siempre es la foto (otras
 * personas, carteles o bebidas en el recorte, o alguien que no parece de su edad). Reintentar
 * con la misma foto no ayuda, así que se pide otra.
 */
function isQualityRejection(caught: unknown) {
  return (
    caught instanceof ApiError &&
    caught.code === 'ai_unavailable' &&
    (caught.details as { reason?: string } | undefined)?.reason === 'quality'
  );
}

const KNOWN_ERRORS = [
  'limit_reached',
  'limit_reached_week',
  'ai_budget_exhausted',
  'validation_failed',
];

/**
 * Las acciones de la cabecera del perfil, según el estado del dibujo: crearlo (con sus fotos
 * vigentes o sus rasgos), elegir el nuevo (que se ve en el retrato) o crear un cuento. Una sola
 * acción principal por estado. Cada dibujo nuevo usa una generación.
 */
export function CharacterDrawing({
  childId,
  name,
  currentUrl,
  drawing,
  onCreateStory,
  onBusyChange,
  onChange,
}: {
  childId: string;
  name: string;
  currentUrl: string | null;
  drawing: Drawing;
  onCreateStory: () => void;
  /** Para que el retrato muestre que se está dibujando. */
  onBusyChange: (drawing: boolean) => void;
  onChange: (next: { imageUrl: string | null; drawing: Drawing }) => void;
}) {
  const t = useTranslations('Account.myStories.drawing');
  const tPreview = useTranslations('Wizard.preview');
  const tProfile = useTranslations('Account.myStories');
  const [busy, setBusy] = useState<'draw' | 'accept' | 'discard' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [aspects, setAspects] = useState<MustKeepTrait[]>([]);
  const [note, setNote] = useState('');
  // Los rasgos que se corrigen (anteojos, pelo…): antes solo se mandaba qué estaba mal y el
  // servidor lo fijaba como estaba, al revés de lo pedido.
  const [traits, setTraits] = useState<TraitDraft>(drawing.traits ?? { glasses: false });
  const [distinctive, setDistinctive] = useState(drawing.traits?.distinctive ?? '');

  async function run(kind: 'draw' | 'accept' | 'discard', call: () => ReturnType<typeof draw>) {
    setBusy(kind);
    if (kind === 'draw') onBusyChange(true);
    setError(null);
    try {
      const { imageUrl, ...next } = await call();
      onChange({ imageUrl, drawing: next });
      setAdjusting(false);
      setAspects([]);
      setNote('');
      setTraits(next.traits ?? { glasses: false });
      setDistinctive(next.traits?.distinctive ?? '');
    } catch (caught) {
      setError(
        isQualityRejection(caught)
          ? t('qualityError')
          : caught instanceof ApiError && KNOWN_ERRORS.includes(caught.code)
            ? tPreview(`errors.${caught.code}`)
            : t('error'),
      );
    } finally {
      setBusy(null);
      onBusyChange(false);
    }
  }

  const draw = (
    body: {
      traits?: CharacterTraits | null;
      mustKeep?: MustKeepTrait[];
      note?: string | null;
    } = {},
  ) => api('generateChildDrawing', { params: { childId }, body });

  /** Con rasgos leídos se mandan corregidos; sin ellos (todavía), solo la nota. */
  const canEditTraits = drawing.traits !== null && AVATAR_TRAITS.every((trait) => traits[trait]);
  function redrawAdjusted() {
    const corrected = canEditTraits
      ? { ...(traits as CharacterTraits), distinctive: distinctive.trim() || null }
      : null;
    // Lo corregido queda fijo, con el valor nuevo (como en la muestra).
    const mustKeep = corrected ? [...new Set([...drawing.mustKeep, ...aspects])] : [];
    void run('draw', () => draw({ traits: corrected, mustKeep, note: note.trim() || null }));
  }

  const drawButton = (label: string, variant: 'default' | 'outline' | 'link') => (
    <Button
      variant={variant}
      className={variant === 'link' ? 'h-auto w-fit px-0' : 'w-fit'}
      disabled={busy !== null}
      onClick={() => void run('draw', () => draw())}
    >
      {busy === 'draw' && <Loader2 className="animate-spin" aria-hidden="true" />}
      {label}
    </Button>
  );
  const storyButton = (variant: 'default' | 'outline') => (
    <Button variant={variant} className="w-fit" disabled={busy !== null} onClick={onCreateStory}>
      {tProfile('profileCreate', { name })}
    </Button>
  );

  return (
    <div className="grid gap-4">
      {busy === 'draw' && (
        <div role="status" className="grid gap-2">
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t('drawing', { name })}
          </p>
          <GenerationProgress compact kinds="child_drawing" className="mx-0" />
        </div>
      )}

      {drawing.candidateUrl ? (
        // Hay un dibujo nuevo (en el retrato): elegir. Si ya tenía uno, se ve chico para comparar.
        <div className="grid gap-3">
          <p className="font-semibold">{currentUrl ? t('choose', { name }) : t('chooseFirst')}</p>
          {currentUrl && (
            <figure className="flex items-center gap-3">
              <div className="aspect-[3/4] w-16 overflow-hidden rounded-lg border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada de 30 min. */}
                <img
                  src={currentUrl}
                  alt={t('currentAlt', { name })}
                  className="size-full object-cover"
                />
              </div>
              <figcaption className="text-sm text-muted-foreground">{t('current')}</figcaption>
            </figure>
          )}
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
              {currentUrl ? t('keep') : t('discard')}
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
        </div>
      ) : currentUrl ? (
        // Con dibujo: lo principal es crear un cuento; actualizarlo queda como link.
        <div className="grid gap-2">
          {storyButton('default')}
          <p className="text-sm text-muted-foreground">{tProfile('profileCreateNote')}</p>
          {drawing.canDraw && (
            <div className="flex flex-wrap items-center gap-x-5">
              {drawButton(t('update'), 'link')}
              <Button
                variant="link"
                className="h-auto w-fit px-0"
                disabled={busy !== null}
                onClick={() => {
                  setAdjusting((open) => !open);
                }}
              >
                {tPreview('correct')}
              </Button>
            </div>
          )}
        </div>
      ) : drawing.canDraw ? (
        // Sin dibujo, con foto o rasgos: lo principal es crearlo; el cuento queda secundario.
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            {drawButton(t('create'), 'default')}
            {storyButton('outline')}
          </div>
          <p className="text-sm text-muted-foreground">{t('note')}</p>
        </div>
      ) : (
        // Sin dibujo ni foto: crear un cuento, o subir una foto para dibujarlo antes.
        <div className="grid gap-2">
          {storyButton('default')}
          <p className="text-sm text-muted-foreground">
            {t.rich('needsPhoto', {
              link: (chunks) => (
                <a href="#su-foto" className="font-semibold text-primary underline">
                  {chunks}
                </a>
              ),
            })}
          </p>
        </div>
      )}

      {adjusting && (
        <div className="grid gap-4 rounded-xl bg-muted/50 p-4">
          {canEditTraits && (
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
          )}
          {canEditTraits &&
          (aspects.some((aspect) => ASPECT_TRAITS[aspect]) || aspects.includes('glasses')) ? (
            <TraitPicker
              idPrefix="drawing"
              value={traits}
              onChange={setTraits}
              only={aspects.flatMap((aspect) => ASPECT_TRAITS[aspect] ?? [])}
              showGlasses={aspects.includes('glasses')}
            />
          ) : null}
          {canEditTraits && aspects.includes('distinctive') && (
            <div className="grid gap-2">
              <label htmlFor="drawing-distinctive" className="font-bold">
                {tPreview('distinctive')}
              </label>
              <input
                id="drawing-distinctive"
                value={distinctive}
                maxLength={60}
                placeholder={tPreview('distinctivePlaceholder')}
                onChange={(event) => {
                  setDistinctive(event.target.value);
                }}
                className="h-11 rounded-lg border bg-card px-3"
              />
            </div>
          )}
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
            onClick={redrawAdjusted}
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
    </div>
  );
}
