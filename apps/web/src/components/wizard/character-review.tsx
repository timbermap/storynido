'use client';

import {
  ApiError,
  MUST_KEEP_TRAITS,
  type CharacterTraits,
  type MustKeepTrait,
  type PublicPreview,
} from '@storynido/shared';
import { Check, Loader2, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { SignInPanel } from '@/components/auth/sign-in-panel';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

import { AVATAR_TRAITS, TraitPicker, type TraitDraft } from './trait-picker';

type Character = NonNullable<NonNullable<PublicPreview['preview']>['character']>;

/**
 * "¿Es él / es ella?": el adulto ve la lámina del personaje y la aprueba, o corrige los rasgos
 * y marca los que no pueden cambiar. Recién con la aprobación se ilustra el libro.
 */
export function CharacterReview({
  bookId,
  childName,
  character,
  regenerationsLeft,
  onUpdated,
  onError,
}: {
  bookId: string;
  childName: string;
  character: Character;
  regenerationsLeft: number;
  onUpdated: (preview: PublicPreview) => void;
  onError: (key: string | null) => void;
}) {
  const t = useTranslations('Wizard.preview');
  const tCharacter = useTranslations('Wizard.character');
  const [editing, setEditing] = useState(false);
  const [traits, setTraits] = useState<TraitDraft>(character.traits);
  const [distinctive, setDistinctive] = useState(character.traits.distinctive ?? '');
  const [mustKeep, setMustKeep] = useState<MustKeepTrait[]>(character.mustKeep);
  const [busy, setBusy] = useState<'approve' | 'save' | null>(null);
  const [needsAccount, setNeedsAccount] = useState(false);

  async function approve() {
    setBusy('approve');
    onError(null);
    try {
      onUpdated(await api('approveCharacter', { params: { bookId } }));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'account_required') setNeedsAccount(true);
      else onError(error instanceof ApiError ? error.code : 'generic');
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (AVATAR_TRAITS.some((trait) => !traits[trait])) return;
    setBusy('save');
    onError(null);
    try {
      const body = {
        traits: { ...(traits as CharacterTraits), distinctive: distinctive.trim() || null },
        mustKeep,
      };
      onUpdated(await api('updateCharacter', { params: { bookId }, body }));
      setEditing(false);
    } catch (error) {
      onError(error instanceof ApiError ? error.code : 'generic');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby="character-review"
      className="grid gap-6 rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] sm:p-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
        {/* URL firmada de corta duración: se muestra tal cual. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={character.imageUrl}
          alt={t('characterAlt', { name: childName })}
          className="size-full object-cover"
        />
        {busy === 'save' && (
          <div role="status" className="absolute inset-0 grid place-items-center bg-background/70">
            <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="grid content-start gap-5">
        <div>
          <h2
            id="character-review"
            className="scroll-mt-28 text-[clamp(1.6rem,3vw,2.2rem)] font-medium"
          >
            {t('characterTitle', { name: childName })}
          </h2>
          <p className="mt-2 text-muted-foreground">{t('characterText')}</p>
        </div>

        {!editing ? (
          <>
            <ul className="flex flex-wrap gap-2 text-sm font-bold">
              {AVATAR_TRAITS.map((trait) => (
                <li key={trait} className="rounded-full bg-secondary px-3 py-1 text-primary">
                  {tCharacter(`options.${trait}.${character.traits[trait]}`)}
                </li>
              ))}
              {character.traits.glasses && (
                <li className="rounded-full bg-secondary px-3 py-1 text-primary">
                  {tCharacter('glasses')}
                </li>
              )}
              {character.traits.distinctive && (
                <li className="rounded-full bg-secondary px-3 py-1 text-primary">
                  {character.traits.distinctive}
                </li>
              )}
            </ul>

            {needsAccount ? (
              <div className="rounded-xl bg-secondary p-5">
                <p className="font-bold">{t('accountTitle')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('accountText')}</p>
                <div className="mt-4">
                  <SignInPanel />
                </div>
              </div>
            ) : (
              <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
                <Button size="lg" disabled={busy !== null} onClick={() => void approve()}>
                  {busy === 'approve' ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Check aria-hidden="true" />
                  )}
                  {t('approve')}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  disabled={busy !== null || regenerationsLeft === 0}
                  onClick={() => {
                    setEditing(true);
                  }}
                >
                  <Pencil aria-hidden="true" />
                  {t('correct')}
                </Button>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {t('approveNote')} {t('regenerationsLeft', { count: regenerationsLeft })}
            </p>
          </>
        ) : (
          <div className="grid gap-6">
            <TraitPicker idPrefix="character" value={traits} onChange={setTraits} />
            <div className="grid gap-2">
              <label htmlFor="character-distinctive" className="font-bold">
                {t('distinctive')}
              </label>
              <input
                id="character-distinctive"
                value={distinctive}
                maxLength={60}
                placeholder={t('distinctivePlaceholder')}
                onChange={(event) => {
                  setDistinctive(event.target.value);
                }}
                className="h-11 rounded-lg border bg-card px-3"
              />
            </div>
            <fieldset>
              <legend className="mb-3 font-bold">{t('mustKeepLegend')}</legend>
              <div className="flex flex-wrap gap-2">
                {MUST_KEEP_TRAITS.map((trait) => {
                  const checked = mustKeep.includes(trait);
                  return (
                    <label
                      key={trait}
                      className={cn(
                        'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 bg-card px-4 text-sm font-bold has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                        checked ? 'border-primary bg-[#faf6fd]' : 'border-border',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--primary)]"
                        checked={checked}
                        onChange={(event) => {
                          setMustKeep((current) =>
                            event.target.checked
                              ? [...current, trait]
                              : current.filter((item) => item !== trait),
                          );
                        }}
                      />
                      {t(`mustKeep.${trait}`)}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="grid gap-2 sm:flex sm:items-center">
              <Button disabled={busy !== null} onClick={() => void save()}>
                {busy === 'save' && <Loader2 className="animate-spin" aria-hidden="true" />}
                {t('saveTraits')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                }}
              >
                {t('cancel')}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{t('correctNote')}</p>
          </div>
        )}
      </div>
    </section>
  );
}
