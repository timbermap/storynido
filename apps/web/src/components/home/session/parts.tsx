'use client';

import Image from 'next/image';

import type { PublicStory } from '@storynido/shared';

import { AUDIENCE_TONES } from '@/lib/audience-tones';
import { StoryCover } from '@/components/stories/story-cover';
import type { HomeChannel } from '@/lib/home-state';
import { cn } from '@/lib/utils';

/** Textos de cada línea que vienen de la landing (los arma el servidor). */
export type LineCopy = Record<HomeChannel, { chip: string; text: string }>;

/** Foto de cada línea (la misma de su landing). */
export const LINE_IMAGES: Record<HomeChannel, string> = {
  families: '/images/heroes/familias-pagina.webp',
  events: '/images/heroes/kit-completo.webp',
  professionals: '/images/heroes/pro-mesa.webp',
};

/** Tarjeta blanca de la marca: borde fino y sombra suave. */
export const cardClass = 'rounded-2xl border bg-card shadow-[var(--shadow-card)]';

/** Píldora de la línea, con su tono (AUDIENCE_TONES). */
export function LineChip({
  line,
  label,
  small = false,
}: {
  line: HomeChannel;
  label: string;
  small?: boolean;
}) {
  const tone = AUDIENCE_TONES[line];
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full font-bold',
        small ? 'px-2 py-px text-[0.72rem]' : 'px-2.5 py-0.5 text-[0.8rem]',
        tone.panel,
        tone.text,
      )}
    >
      <span className={cn('size-1.5 rounded-full', tone.dot)} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Píldora de estado (borrador, vista previa lista, en camino…). */
export function StatusChip({ children }: { children: string }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-muted px-2.5 py-0.5 text-[0.8rem] font-bold text-foreground">
      {children}
    </span>
  );
}

/**
 * Miniatura de un proyecto: la portada generada si existe; si no, la de su historia del
 * catálogo, el dibujo del personaje o la foto de la línea.
 */
export function Thumb({
  src,
  story,
  name,
  line,
  sizes,
  priority = false,
}: {
  src: string | null;
  story: PublicStory | undefined;
  name: string | null;
  line: HomeChannel;
  sizes: string;
  priority?: boolean;
}) {
  if (!src && story) {
    return <StoryCover story={story} name={name} line={line} sizes={sizes} priority={priority} />;
  }
  return (
    <Image
      src={src ?? LINE_IMAGES[line]}
      alt=""
      fill
      unoptimized
      priority={priority}
      sizes={sizes}
      className="object-cover"
    />
  );
}
