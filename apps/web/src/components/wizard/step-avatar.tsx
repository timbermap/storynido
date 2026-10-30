'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { Avatar } from '@storynido/shared';

import { getFirebaseDb } from '@/lib/firebase/client';
import { updateBook } from '@/lib/firebase/drafts';

import { CharacterModeChooser } from './character-mode';
import { AVATAR_TRAITS, TraitPicker, type TraitDraft } from './trait-picker';
import type { StepNav, WizardData } from './types';
import { WizardShell } from './wizard-shell';

/** Modo sin foto: rasgos del protagonista para ilustrarlo de forma consistente. */
export function StepAvatar({ nav, data }: { nav: StepNav; data: WizardData }) {
  const t = useTranslations('Wizard.character');
  const [avatar, setAvatar] = useState<TraitDraft>(data.book.avatar ?? { glasses: false });
  const [error, setError] = useState<string | null>(null);

  async function next() {
    if (AVATAR_TRAITS.some((trait) => !avatar[trait])) {
      setError(t('required'));
      return;
    }
    const ok = await nav.save(async () => {
      await updateBook(await getFirebaseDb(), await nav.ensureBook(), { avatar: avatar as Avatar });
    });
    if (ok) await nav.goNext();
  }

  return (
    <WizardShell
      {...nav}
      title={t('avatarTitle')}
      subtitle={t('avatarSubtitle')}
      error={error}
      onNext={() => void next()}
    >
      <div className="grid gap-8">
        <CharacterModeChooser nav={nav} data={data} />

        <TraitPicker
          idPrefix="avatar"
          value={avatar}
          onChange={(value) => {
            setAvatar(value);
            setError(null);
          }}
        />
      </div>
    </WizardShell>
  );
}
