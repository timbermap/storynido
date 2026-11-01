'use client';

import Image from 'next/image';

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
}: {
  before?: string;
  name?: string;
  after?: string;
  ink?: 'dark' | 'light';
}) {
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
  return (
    <p
      className={cn(
        'absolute inset-x-0 top-0 grid h-[30%] content-center justify-items-center gap-[1.2cqw] px-[7cqw] text-center font-display leading-[1.05] font-semibold',
        ink === 'light' ? 'text-[#fff7f2]' : 'text-[#26324a]',
      )}
    >
      {before && <span className={name ? 'text-[6.2cqw]' : 'text-[8.5cqw]'}>{before}</span>}
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
        <CoverTitle before={parts.before} name={visitor} after={parts.after} ink={ink} />
      )}
    </div>
  );
}
