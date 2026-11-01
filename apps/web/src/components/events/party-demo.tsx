'use client';

import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

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
  themes: { slug: string; name: string; image?: string | undefined }[];
  /** Textos ya traducidos por el servidor (no viaja todo el namespace de la landing). `previewAlt` lleva {name} y {theme}. */
  labels: Record<
    | 'youAreInvited'
    | 'birthday'
    | 'sample'
    | 'photo'
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
  // La foto de muestra es del mismo chico que el dibujo del primer tema (el cumpleaños).
  const showPhoto = themeIndex === 0 && Boolean(theme?.image);
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="relative">
        <div
          role="img"
          aria-label={t('previewAlt', { name: shown, theme: theme?.name ?? '' })}
          className={cn(
            'overflow-hidden rounded-2xl bg-gradient-to-b',
            TONES[themeIndex % TONES.length],
          )}
        >
          {/* El texto va en su propio panel: nunca se sale ni se pisa con el dibujo. */}
          <div
            aria-hidden="true"
            className={cn(
              'grid gap-1.5 px-5 pt-6 pb-5 text-center',
              // Con la foto de muestra en la esquina, el texto se angosta para no tocarla.
              showPhoto && 'pl-[26%] sm:px-[26%]',
            )}
          >
            <p className="text-xs font-bold tracking-[0.14em] uppercase">{t('youAreInvited')}</p>
            <p className="font-display text-[clamp(1.9rem,6vw,2.75rem)] leading-tight font-bold break-words">
              {shown}
            </p>
            <p className="text-lg font-medium">{t('birthday')}</p>
          </div>
          {/* La ilustración sin su tercio superior vacío, que ya cubre el panel de texto. */}
          {theme?.image && (
            <Image
              src={theme.image}
              alt=""
              aria-hidden="true"
              width={600}
              height={800}
              unoptimized
              className="aspect-[25/24] w-full object-cover object-bottom"
            />
          )}
        </div>
        {/* De su foto a su personaje: la foto de muestra del chico que ilustra esta invitación. */}
        {showPhoto && (
          <div
            aria-hidden="true"
            className="absolute -top-3 -left-2 flex w-[24%] -rotate-6 flex-col items-center rounded-md bg-card p-1.5 pb-2 shadow-[var(--shadow-book)]"
          >
            <Image
              src="/images/secciones/foto-real.webp"
              alt=""
              width={300}
              height={300}
              unoptimized
              className="aspect-square w-full rounded-sm object-cover"
            />
            <span className="mt-1 inline-flex items-center gap-0.5 text-[0.65rem] font-bold">
              {t('photo')}
              <ArrowRight className="size-3 text-primary" aria-hidden="true" />
            </span>
          </div>
        )}
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
