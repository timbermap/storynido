'use client';

import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { MEMORY_KEYS, MEMORY_MAX_LENGTH, type Memories } from '@storynido/shared';

import { Button } from '@/components/ui/button';
import { getFirebaseDb } from '@/lib/firebase/client';
import { updateBook } from '@/lib/firebase/drafts';
import { useStepDraft } from '@/lib/use-step-draft';

import type { StepNav, WizardData } from './types';
import { WizardShell } from './wizard-shell';

const EMPTY: Memories = { moment: null, companion: null, nickname: null, favorite: null };

/** Recuerdos guiados: detalles reales y opcionales que la historia convierte en escenas. */
export function StepMemories({ nav, data }: { nav: StepNav; data: WizardData }) {
  const t = useTranslations('Wizard.memories');
  const [values, setValues] = useState<Memories>(data.book.memories ?? EMPTY);
  const clearDraft = useStepDraft(data.book.id, 'memories', values, setValues);

  async function save(memories: Memories) {
    const ok = await nav.save(async () => {
      await updateBook(await getFirebaseDb(), data.book.id, { memories });
    });
    if (ok) {
      clearDraft();
      await nav.goNext();
    }
  }

  function next() {
    const cleaned = Object.fromEntries(
      MEMORY_KEYS.map((key) => [key, values[key]?.trim() ? values[key].trim() : null]),
    ) as Memories;
    void save(cleaned);
  }

  return (
    <WizardShell {...nav} title={t('title')} subtitle={t('subtitle')} onNext={next}>
      <div className="grid gap-6">
        <p className="flex items-start gap-2 rounded-xl bg-mint p-4 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          {t('privacy')}
        </p>
        {MEMORY_KEYS.map((key) => {
          const id = `memory-${key}`;
          const value = values[key] ?? '';
          return (
            <div key={key} className="grid gap-2">
              <label htmlFor={id} className="font-bold">
                {t(key)}
              </label>
              <textarea
                id={id}
                rows={key === 'moment' ? 3 : 2}
                maxLength={MEMORY_MAX_LENGTH}
                placeholder={t(`${key}Placeholder`)}
                value={value}
                aria-describedby={`${id}-count`}
                onChange={(event) => {
                  setValues((current) => ({ ...current, [key]: event.target.value }));
                }}
                className="w-full rounded-lg border bg-card p-3"
              />
              <span id={`${id}-count`} className="text-right text-xs text-muted-foreground">
                {value.length}/{MEMORY_MAX_LENGTH}
              </span>
            </div>
          );
        })}
        <Button
          variant="ghost"
          className="justify-self-start"
          onClick={() => {
            void save(data.book.memories ?? EMPTY);
          }}
        >
          {t('skip')}
        </Button>
      </div>
    </WizardShell>
  );
}
