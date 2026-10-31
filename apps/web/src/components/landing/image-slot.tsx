'use client';

import Image from 'next/image';
import { useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * Imagen de marca con su lugar reservado (rediseño de imágenes, DECISIONS 157). Mientras el
 * archivo no exista se ve un bloque de color con la proporción correcta —nunca la imagen vieja—,
 * así el sitio funciona con y sin las imágenes nuevas.
 */
export function ImageSlot({
  src,
  alt,
  width,
  height,
  sizes,
  priority = false,
  tone = 'bg-[#ece7fb]',
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  priority?: boolean;
  /** Color del bloque que ocupa el lugar si falta el archivo. */
  tone?: string;
  className?: string;
}) {
  const [missing, setMissing] = useState(false);
  if (missing) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn('w-full', tone, className)}
        style={{ aspectRatio: `${String(width)} / ${String(height)}` }}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      unoptimized
      onError={() => {
        setMissing(true);
      }}
      className={cn('h-auto w-full', className)}
    />
  );
}
