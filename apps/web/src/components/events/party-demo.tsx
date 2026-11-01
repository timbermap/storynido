'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { CoverTitle } from '@/components/stories/story-cover';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const NAME_KEY = 'storynido:partyName';
const NAME_MAX = 30;

/** Un fondo por tema, de la paleta de la marca (la invitación de muestra cambia con el tema). */
const TONES = [
  'from-peach to-[#fde7df] text-[#7a2f23]',
  'from-mint to-[#e7f2e6] text-success',
  'from-secondary to-[#efeaf8] text-primary',
] as const;

/**
 * Hero de Celebraciones: el nombre del cumpleañero y el tema cambian en vivo una invitación de
 * muestra, sin cuenta. El nombre queda en este dispositivo (sin storage, funciona igual).
 */
export function PartyDemo({
  themes,
  labels,
}: {
  themes: { slug: string; name: string; image?: string | undefined; ink?: 'dark' | 'light' }[];
  /** Textos ya traducidos por el servidor (no viaja todo el namespace de la landing). `previewAlt` lleva {name} y {theme}. */
  labels: Record<
    | 'youAreInvited'
    | 'birthday'
    | 'sample'
    | 'nameLabel'
    | 'namePlaceholder'
    | 'themeLabel'
    | 'cta'
    | 'previewAlt',
    string
  >;
}) {
  const t = (key: keyof typeof labels, values?: Record<string, string>) =>
    Object.entries(values ?? {}).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, value),
      labels[key],
    );
  const [name, setName] = useState('');
  const [themeIndex, setThemeIndex] = useState(0);

  // Se lee después de montar: localStorage no existe en el render del servidor.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(NAME_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el navegador
      if (saved) setName(saved.slice(0, NAME_MAX));
    } catch {
      // Sin storage (modo privado): la muestra funciona igual.
    }
  }, []);

  function change(value: string) {
    const next = value.slice(0, NAME_MAX);
    setName(next);
    try {
      window.localStorage.setItem(NAME_KEY, next);
    } catch {
      // Sin storage: nada que guardar.
    }
  }

  const theme = themes[themeIndex] ?? themes[0];
  const shown = name.trim() || t('namePlaceholder');
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div
        role="img"
        aria-label={t('previewAlt', { name: shown, theme: theme?.name ?? '' })}
        className={cn(
          '[container-type:inline-size] relative aspect-[3/4] overflow-hidden rounded-2xl bg-gradient-to-b',
          TONES[themeIndex % TONES.length],
        )}
      >
        {/* La ilustración completa del tema, sin recortes; el texto va en su tercio superior vacío. */}
        {theme?.image && (
          <Image
            src={theme.image}
            alt=""
            aria-hidden="true"
            width={600}
            height={800}
            unoptimized
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div aria-hidden="true">
          <CoverTitle
            before={t('youAreInvited')}
            name={shown}
            after={t('birthday')}
            ink={theme?.ink ?? 'dark'}
            layout="C"
          />
        </div>
      </div>
      <p aria-hidden="true" className="mt-2 text-center text-xs text-muted-foreground">
        {t('sample')}
      </p>

      <div className="mt-4 grid gap-4">
        <div>
          <label htmlFor="party-name" className="text-sm font-bold">
            {t('nameLabel')}
          </label>
          <input
            id="party-name"
            value={name}
            maxLength={NAME_MAX}
            onChange={(event) => {
              change(event.target.value);
            }}
            placeholder={t('namePlaceholder')}
            autoComplete="off"
            className="mt-1.5 h-12 w-full rounded-xl border bg-background px-4 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>
        {themes.length > 0 && (
          <div>
            <label htmlFor="party-theme" className="text-sm font-bold">
              {t('themeLabel')}
            </label>
            <select
              id="party-theme"
              value={themeIndex}
              onChange={(event) => {
                setThemeIndex(Number(event.target.value));
              }}
              className="mt-1.5 h-12 w-full rounded-xl border bg-background px-3 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {themes.map((item, index) => (
                <option key={item.slug} value={index}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <Link
          href={{
            pathname: '/create',
            query: { line: 'events', ...(theme ? { tema: theme.name } : {}) },
          }}
          data-track="party_demo_start"
          className={cn(buttonVariants({ size: 'lg' }), 'w-full')}
        >
          {t('cta')}
        </Link>
      </div>
    </div>
  );
}
