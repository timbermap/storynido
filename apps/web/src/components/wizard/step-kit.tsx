'use client';

import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  CHILD_LIMITS,
  EMPTY_BIRTHDAY,
  INVITATION_TONES,
  type InvitationTone,
  type KitOffer,
  type Locale,
} from '@storynido/shared';

import { getFirebaseDb } from '@/lib/firebase/client';
import { updateBook } from '@/lib/firebase/drafts';
import { formatPrice } from '@/lib/format';
import { useStepDraft } from '@/lib/use-step-draft';

import { OptionCard } from './option-card';
import { inputClass, labelClass } from './step-child';
import type { StepNav, WizardData } from './types';
import { WizardShell } from './wizard-shell';

const KIT_INCLUDES = ['invitation', 'decoration', 'keepsake', 'activities'] as const;

/** Celebraciones, etapa Ajustes: kit completo o solo invitación, dedicatoria y tono. */
export function StepKit({ nav, data }: { nav: StepNav; data: WizardData }) {
  const t = useTranslations('Wizard.kit');
  const locale = useLocale() as Locale;
  const { book, child, eventPrices } = data;
  const [offer, setOffer] = useState<KitOffer>(book.event?.offer ?? 'full_kit');
  const [tone, setTone] = useState<InvitationTone>(book.event?.tone ?? 'fun');
  const [dedication, setDedication] = useState(book.dedication ?? '');
  const clearDraft = useStepDraft(book.id, 'kit', { offer, tone, dedication }, (saved) => {
    setOffer(saved.offer);
    setTone(saved.tone);
    setDedication(saved.dedication);
  });
  const money = (minor: number) =>
    eventPrices ? formatPrice(minor, eventPrices.currency, locale, eventPrices.country) : '';

  async function next() {
    const ok = await nav.save(async () => {
      await updateBook(await getFirebaseDb(), await nav.ensureBook(), {
        event: { ...EMPTY_BIRTHDAY, ...book.event, offer, tone },
        dedication: dedication.trim() ? dedication.trim() : null,
      });
    });
    if (ok) {
      clearDraft();
      await nav.goNext();
    }
  }

  return (
    <WizardShell
      {...nav}
      title={t('title')}
      subtitle={t('subtitle')}
      nextLabel={t('next')}
      onNext={() => void next()}
    >
      <div className="grid gap-8">
        <fieldset>
          <legend className="sr-only">{t('title')}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <OptionCard
              name="kit-offer"
              value="full_kit"
              checked={offer === 'full_kit'}
              onSelect={() => {
                setOffer('full_kit');
              }}
            >
              <span className="grid gap-3 p-5">
                <span className="w-fit rounded-full bg-mint px-2.5 py-0.5 text-xs font-bold text-success">
                  {t('recommended')}
                </span>
                <span className="font-display text-xl font-semibold">{t('fullKit')}</span>
                {eventPrices && (
                  <span className="text-lg font-bold tabular-nums">
                    {money(eventPrices.fullKitMinor)}
                  </span>
                )}
                <ul className="grid gap-1.5 text-sm">
                  {KIT_INCLUDES.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                      {t(`includes.${item}`)}
                    </li>
                  ))}
                </ul>
              </span>
            </OptionCard>
            <OptionCard
              name="kit-offer"
              value="invitation"
              checked={offer === 'invitation'}
              onSelect={() => {
                setOffer('invitation');
              }}
            >
              <span className="grid gap-3 p-5">
                <span className="font-display text-xl font-semibold">{t('invitationOnly')}</span>
                {eventPrices && (
                  <span className="text-lg font-bold tabular-nums">
                    {money(eventPrices.invitationMinor)}
                  </span>
                )}
                <span className="text-sm text-muted-foreground">{t('invitationOnlyText')}</span>
              </span>
            </OptionCard>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{t('copiesNote')}</p>
        </fieldset>

        {offer === 'full_kit' && (
          <div className="grid gap-2">
            <label htmlFor="kit-dedication" className={labelClass}>
              {t('dedication')}
            </label>
            <textarea
              id="kit-dedication"
              className={`${inputClass} h-28 py-3`}
              value={dedication}
              maxLength={CHILD_LIMITS.dedicationMaxLength}
              placeholder={t('dedicationPlaceholder', { name: child?.name ?? '' })}
              aria-describedby="kit-dedication-hint"
              onChange={(event) => {
                setDedication(event.target.value);
              }}
            />
            <p id="kit-dedication-hint" className="text-sm text-muted-foreground">
              {t('dedicationHint')}
            </p>
          </div>
        )}

        <fieldset>
          <legend className="mb-3 font-semibold">{t('toneLegend')}</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {INVITATION_TONES.map((value) => (
              <OptionCard
                key={value}
                name="invitation-tone"
                value={value}
                checked={tone === value}
                onSelect={() => {
                  setTone(value);
                }}
              >
                <span className="grid gap-1 p-4">
                  <span className="font-semibold">{t(`tones.${value}.name`)}</span>
                  <span className="pr-6 text-sm text-muted-foreground">
                    {t(`tones.${value}.sample`)}
                  </span>
                </span>
              </OptionCard>
            ))}
          </div>
        </fieldset>
      </div>
    </WizardShell>
  );
}
