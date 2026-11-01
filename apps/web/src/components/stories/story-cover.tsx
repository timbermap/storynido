'use client';

import Image from 'next/image';
import { useId } from 'react';

import type { PublicStory } from '@storynido/shared';

import { cn } from '@/lib/utils';
import { useVisitorName } from '@/lib/visitor-name';

type CoverStory = Pick<
  PublicStory,
  | 'coverImage'
  | 'title'
  | 'titleParts'
  | 'titlePro'
  | 'coverTitleOverlay'
  | 'coverInk'
  | 'coverLayout'
  | 'coverImagePro'
  | 'castName'
>;

/**
 * Título sobre el tercio superior vacío de una portada, con la tipografía de la marca: lo de antes
 * del nombre, el nombre más grande y lo de después. Sin nombre (Profesionales), una sola línea.
 */
export function CoverTitle({
  before = '',
  name,
  after = '',
  ink = 'dark',
  layout = 'A',
}: {
  before?: string;
  name?: string;
  after?: string;
  ink?: 'dark' | 'light';
  /** A centrado, B arriba a la izquierda en dos niveles, C con el nombre en arco suave. */
  layout?: 'A' | 'B' | 'C';
}) {
  const arcId = useId();
  // Lo pegado al nombre viaja con él y no queda suelto en su línea: la puntuación ("¡" antes, ","
  // después) y el posesivo del inglés ("TOM's", con la "s" en minúscula).
  let lead = '';
  let suffix = '';
  if (name) {
    if (/^[\s¡¿"«]*$/u.test(before)) {
      lead = before.trim();
      before = '';
    }
    suffix = /^(?:['’]s\b)?[,.;:!?»"]*/iu.exec(after)?.[0] ?? '';
    after = after.slice(suffix.length).trim();
  }
  const color = ink === 'light' ? 'text-[#fff7f2]' : 'text-[#26324a]';
  // Sin franja de color: el texto va directo sobre el tercio vacío de la imagen. La fuente sale de
  // --font-cover (hoy la de la marca; ahí se carga la propia cuando esté el archivo).
  const base =
    'absolute inset-x-0 top-0 grid h-[30%] gap-[1.2cqw] font-[family-name:var(--font-cover)] leading-[1.05] font-semibold';
  const small = name ? 'text-[6.2cqw]' : 'text-[8.5cqw]';
  const full = `${lead}${name ?? ''}${suffix}`;

  if (layout === 'C' && name) {
    // El nombre sigue un arco suave; el tamaño baja con el largo para que entre entero.
    const size = Math.min(15, 90 / (Math.max(full.length, 4) * 0.62));
    return (
      <p className={cn(base, 'content-center justify-items-center px-[7cqw] text-center', color)}>
        {before && <span className="text-[6.2cqw]">{before}</span>}
        <span className="sr-only">{full}</span>
        <svg aria-hidden="true" viewBox="0 0 100 22" className="-my-[1cqw] w-full overflow-visible">
          <path id={arcId} d="M4 19 Q50 3 96 19" fill="none" />
          <text
            fontSize={size}
            textAnchor="middle"
            className="fill-current font-[family-name:var(--font-cover)] font-semibold tracking-tight uppercase"
          >
            <textPath href={`#${arcId}`} startOffset="50%">
              {lead}
              {name}
              <tspan className="normal-case">{suffix}</tspan>
            </textPath>
          </text>
        </svg>
        {after && <span className="text-[6.2cqw]">{after}</span>}
      </p>
    );
  }

  const left = layout === 'B' && name;
  return (
    <p
      className={cn(
        base,
        left
          ? 'content-center justify-items-start px-[8cqw] text-left'
          : 'content-center justify-items-center px-[7cqw] text-center',
        color,
      )}
    >
      {before && <span className={small}>{before}</span>}
      {name && (
        <span className="text-[13cqw] tracking-tight uppercase">
          {lead}
          {name}
          <span className="normal-case">{suffix}</span>
        </span>
      )}
      {after && <span className="text-[6.2cqw]">{after}</span>}
    </p>
  );
}

/**
 * Portada de una historia (rediseño de imágenes, DECISIONS 157). Con el flag, la imagen trae el
 * tercio superior vacío y el título se superpone: con el nombre más grande ("La gran aventura
 * espacial de" + "TOMÁS"), el del visitante si lo escribió o el del elenco. Sin el flag, se muestra
 * la portada tal cual. Nunca se muestra la marca "[Nombre]".
 */
export function StoryCover({
  story,
  line,
  sizes,
  priority = false,
  className,
  alt = '',
}: {
  story: CoverStory;
  alt?: string;
  /** Línea desde la que se mira (Profesionales usa su propia portada y título si la historia los tiene). */
  line?: string | null;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  // El nombre que escribió el visitante («¿Cómo se llama?»); sin él, el del elenco de la historia.
  const typed = useVisitorName();
  const visitor = typed ?? story.castName ?? '';
  const pro = line === 'professionals' && Boolean(story.coverImagePro);
  const src = pro && story.coverImagePro ? story.coverImagePro : story.coverImage;
  const overlay = Boolean(story.coverTitleOverlay);
  const image = (
    <Image
      src={src}
      alt={alt}
      width={600}
      height={800}
      unoptimized
      priority={priority}
      sizes={sizes}
      className={cn('h-full w-full object-cover', !overlay && className)}
    />
  );
  if (!overlay) return image;
  const ink = story.coverInk === 'light' ? 'light' : 'dark';
  const parts = story.titleParts;
  return (
    <div className={cn('[container-type:inline-size] relative h-full w-full', className)}>
      {image}
      {pro || !parts ? (
        <CoverTitle before={pro ? (story.titlePro ?? story.title) : story.title} ink={ink} />
      ) : (
        <CoverTitle
          before={parts.before}
          name={visitor}
          after={parts.after}
          ink={ink}
          layout={story.coverLayout}
        />
      )}
    </div>
  );
}
