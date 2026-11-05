'use client';

import Image from 'next/image';
import { useId } from 'react';

import { letterJitter, type PublicStory } from '@storynido/shared';

import { cn } from '@/lib/utils';

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
 * Textura de crayón (DECISIONS: portadas en Amatic SC, 05/11): el borde de la letra apenas
 * irregular y un grano fino que deja ver el papel, como en los libros dibujados a mano.
 */
function CrayonFilter({ id }: { id: string }) {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      <filter id={id} x="-5%" y="-15%" width="110%" height="130%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.8"
          numOctaves="2"
          seed="3"
          result="edge"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="edge"
          scale="1.4"
          xChannelSelector="R"
          yChannelSelector="G"
          result="rough"
        />
        <feTurbulence
          type="fractalNoise"
          baseFrequency="1.7"
          numOctaves="1"
          seed="7"
          result="grain"
        />
        <feColorMatrix
          in="grain"
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.1 0 0 0 1.35"
          result="mask"
        />
        <feComposite in="rough" in2="mask" operator="in" />
      </filter>
    </svg>
  );
}

/** El nombre letra por letra, cada una con su leve giro (el mismo en la muestra y en el libro). */
function HandName({ text }: { text: string }) {
  return (
    <>
      {letterJitter(text).map((letter, index) => (
        <span
          key={index}
          className="inline-block whitespace-pre"
          style={{
            transform: `translateY(${String(letter.shift)}em) rotate(${String(letter.rotate)}deg)`,
          }}
        >
          {letter.char}
        </span>
      ))}
    </>
  );
}

/**
 * Título sobre el tercio superior vacío de una portada, con letra a mano (Amatic SC): lo de antes
 * del nombre, el nombre grande y lo de después. Sin nombre (Profesionales), una sola línea.
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
  const crayonId = useId();
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
  // Sin franja de color: el texto va directo sobre el tercio vacío de la imagen.
  const base =
    'absolute inset-x-0 top-0 grid h-[30%] gap-[0.6cqw] font-[family-name:var(--font-cover)] leading-[0.95] font-bold';
  const small = name ? 'text-[9cqw]' : 'text-[12cqw]';
  const full = `${lead}${name ?? ''}${suffix}`;
  // Amatic es angosta: el nombre va ~1,4 veces más grande, y baja con los nombres largos.
  const nameSize = Math.min(22, 86 / (Math.max(full.length, 4) * 0.36));
  const crayon = { filter: `url(#${crayonId})` };

  if (layout === 'C' && name) {
    // El nombre sigue un arco suave; el tamaño baja con el largo para que entre entero.
    const size = Math.min(26, 90 / (Math.max(full.length, 4) * 0.36));
    const letters = letterJitter(`${lead}${name}`);
    return (
      <p
        className={cn(base, 'content-center justify-items-center px-[7cqw] text-center', color)}
        style={crayon}
      >
        <CrayonFilter id={crayonId} />
        {before && <span className="text-[9cqw]">{before}</span>}
        <span className="sr-only">{full}</span>
        <svg
          aria-hidden="true"
          viewBox="0 -4 100 21"
          className="-my-[1cqw] w-full overflow-visible"
        >
          <path id={arcId} d="M4 13 Q50 1 96 13" fill="none" />
          <text
            fontSize={size}
            textAnchor="middle"
            className="fill-current font-[family-name:var(--font-cover)] font-bold uppercase"
          >
            <textPath href={`#${arcId}`} startOffset="50%">
              <tspan
                rotate={letters.map((letter) => letter.rotate).join(' ')}
                dy={letters
                  .map(
                    (letter, index) =>
                      String(round2(letter.shift - (letters[index - 1]?.shift ?? 0))) + 'em',
                  )
                  .join(' ')}
              >
                {lead}
                {name}
              </tspan>
              <tspan className="normal-case">{suffix}</tspan>
            </textPath>
          </text>
        </svg>
        {after && <span className="text-[9cqw]">{after}</span>}
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
      style={crayon}
    >
      <CrayonFilter id={crayonId} />
      {before && <span className={small}>{before}</span>}
      {name && (
        <span className="uppercase" style={{ fontSize: `${String(nameSize)}cqw` }}>
          <span className="sr-only">{full}</span>
          <span aria-hidden="true">
            <HandName text={`${lead}${name}`} />
            <span className="normal-case">{suffix}</span>
          </span>
        </span>
      )}
      {after && <span className="text-[9cqw]">{after}</span>}
    </p>
  );
}

const round2 = (value: number) => Math.round(value * 100) / 100;

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
  name,
}: {
  story: CoverStory;
  alt?: string;
  /** Nombre del protagonista para poner en la portada (si no, el del elenco de la historia). */
  name?: string | null;
  /** Línea desde la que se mira (Profesionales usa su propia portada y título si la historia los tiene). */
  line?: string | null;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  // Siempre el nombre del elenco: un nombre escrito podría no corresponder al dibujo (un nombre de
  // varón sobre una nena). El nombre propio vuelve cuando el nombre y el dibujo puedan coincidir.
  const typedName = name?.trim();
  const visitor =
    typedName !== undefined && typedName.length > 0 ? typedName : (story.castName ?? '');
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
