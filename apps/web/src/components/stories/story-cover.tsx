'use client';

import Image from 'next/image';

import type { PublicStory } from '@storynido/shared';

import { cn } from '@/lib/utils';

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
  return (
    <p
      className={cn(
        'absolute inset-x-0 top-0 grid h-[30%] content-center justify-items-center gap-[1.2cqw] px-[7cqw] text-center font-display leading-[1.05] font-semibold',
        ink === 'light' ? 'text-[#fff7f2]' : 'text-[#26324a]',
      )}
    >
      {before && <span className={name ? 'text-[6.2cqw]' : 'text-[8.5cqw]'}>{before}</span>}
      {name && <span className="text-[13cqw] tracking-tight uppercase">{name}</span>}
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
  // Siempre el nombre del elenco: la ilustración es de ese chico, y un nombre escrito por el visitante
  // podría no corresponder al dibujo. El nombre propio solo se ve en la demo de la landing de Familias.
  const visitor = story.castName ?? '';
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
