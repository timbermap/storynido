'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { getFirebaseDb } from '@/lib/firebase/client';
import { updateBook } from '@/lib/firebase/drafts';

import { OptionCard } from './option-card';
import type { StepNav, WizardData } from './types';
import { WizardShell } from './wizard-shell';

/** Respaldo de color si un estilo todavía no tiene ilustración de muestra. */
const SWATCHES: Record<string, string> = {
  acuarela: 'bg-[radial-gradient(circle_at_30%_30%,#eadcf2,#c9d9ff_45%,#f5d9c9)]',
  'cartoon-3d': 'bg-[linear-gradient(135deg,#ffb36b,#ff7a8a_50%,#7a6cff)]',
  'cuento-clasico': 'bg-[linear-gradient(135deg,#e8d3a6,#c98a5a_60%,#6b3f2a)]',
  'lapices-de-colores':
    'bg-[repeating-linear-gradient(45deg,#fbedc6_0_10px,#ddf1e8_10px_20px,#e1effa_20px_30px)]',
};

export function StepStyle({ nav, data }: { nav: StepNav; data: WizardData }) {
  const t = useTranslations('Wizard.style');
  // Para colorear solo se ofrece el estilo de contornos (y al revés).
  const styles = data.styles.filter((style) => style.contentTypes.includes(data.book.contentType));
  const [selected, setSelected] = useState(
    styles.some((style) => style.slug === data.book.styleId)
      ? data.book.styleId
      : styles.length === 1
        ? (styles[0]?.slug ?? null)
        : null,
  );
  const [error, setError] = useState<string | null>(null);

  async function next() {
    if (!selected) {
      setError(t('required'));
      return;
    }
    const ok = await nav.save(async () => {
      await updateBook(await getFirebaseDb(), data.book.id, { styleId: selected });
    });
    if (ok) await nav.goNext();
  }

  return (
    <WizardShell
      {...nav}
      title={t('title')}
      subtitle={data.book.contentType === 'coloring' ? t('coloring') : t('subtitle')}
      error={error}
      onNext={() => void next()}
    >
      <fieldset>
        <legend className="sr-only">{t('title')}</legend>
        <div className="grid grid-cols-2 gap-4">
          {styles.map((style) => (
            <OptionCard
              key={style.slug}
              name="style"
              value={style.slug}
              checked={selected === style.slug}
              onSelect={(value) => {
                setSelected(value);
                setError(null);
              }}
            >
              {style.sampleImage ? (
                <Image
                  src={style.sampleImage}
                  alt=""
                  width={800}
                  height={600}
                  sizes="(min-width: 640px) 320px, 45vw"
                  unoptimized
                  className="block aspect-[4/3] w-full object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className={`block aspect-[4/3] w-full ${SWATCHES[style.slug] ?? 'bg-muted'}`}
                />
              )}
              <span className="p-3 font-display text-lg font-semibold">{style.name}</span>
            </OptionCard>
          ))}
        </div>
      </fieldset>
    </WizardShell>
  );
}
