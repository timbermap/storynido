'use client';

import { Camera, Palette } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import type { CharacterMode } from '@storynido/shared';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { getFirebaseDb } from '@/lib/firebase/client';
import { updateBook } from '@/lib/firebase/drafts';

import type { StepNav, WizardData } from './types';
import { WizardShell } from './wizard-shell';

/**
 * Personaje con dibujo aprobado en su perfil: «Usamos el dibujo de…» y «Siguiente» directo. El
 * cuento usa ese dibujo como lámina (no se genera otra). «Cambiar» vuelve a fotos o rasgos.
 */
export function StepDrawing({ nav, data }: { nav: StepNav; data: WizardData }) {
  const t = useTranslations('Wizard.drawing');
  const name = data.child?.name ?? '';
  const childId = data.book.childId;
  const [imageUrl, setImageUrl] = useState<string | null | undefined>(undefined);
  const [changing, setChanging] = useState(false);

  function switchTo(mode: CharacterMode) {
    void nav.save(async () => {
      await updateBook(await getFirebaseDb(), data.book.id, {
        useDrawing: false,
        characterMode: mode,
      });
    });
  }

  useEffect(() => {
    if (!childId) return;
    api('getChildProfile', { params: { childId } })
      .then((profile) => {
        setImageUrl(profile.characterImageUrl);
      })
      .catch(() => {
        setImageUrl(null);
      });
  }, [childId]);

  // Ya no tiene dibujo (lo borró o falló la lectura): se sigue con sus fotos o rasgos.
  useEffect(() => {
    if (imageUrl === null) switchTo(data.book.characterMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  return (
    <WizardShell
      {...nav}
      title={t('title', { name })}
      subtitle={t('subtitle')}
      onNext={() => void nav.goNext()}
      nextDisabled={!imageUrl}
    >
      <div className="grid gap-6 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-start">
        <div className="aspect-[3/4] w-40 overflow-hidden rounded-2xl border bg-card sm:w-full">
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- URL firmada de 30 min.
            <img src={imageUrl} alt={t('alt', { name })} className="size-full object-cover" />
          )}
        </div>
        <div className="grid gap-3">
          <p className="font-display text-lg font-semibold">{t('using', { name })}</p>
          <p className="text-muted-foreground">{t('text')}</p>
          <button
            type="button"
            aria-expanded={changing}
            className="w-fit text-sm font-semibold text-primary underline-offset-4 hover:underline"
            onClick={() => {
              setChanging((open) => !open);
            }}
          >
            {t('change')}
          </button>
          {changing && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  switchTo('photo');
                }}
              >
                <Camera aria-hidden="true" />
                {t('otherPhotos')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  switchTo('avatar');
                }}
              >
                <Palette aria-hidden="true" />
                {t('traits')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </WizardShell>
  );
}
