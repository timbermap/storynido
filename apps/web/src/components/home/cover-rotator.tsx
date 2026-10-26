'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

interface Cover {
  src: string;
  title: string;
}

/** Alterna las portadas con un fundido CSS. La primera ya viene renderizada del servidor. */
export function CoverRotator({ covers }: { covers: Cover[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || covers.length < 2) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % covers.length);
    }, 3500);
    return () => {
      clearInterval(timer);
    };
  }, [covers.length]);

  return (
    <>
      {covers.map((cover, i) => (
        // SVG propios: se sirven tal cual. Solo la primera portada se carga de inmediato.
        <Image
          key={cover.src}
          src={cover.src}
          alt={i === index ? cover.title : ''}
          aria-hidden={i !== index}
          width={600}
          height={800}
          unoptimized
          priority={i === 0}
          loading={i === 0 ? undefined : 'lazy'}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === index ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}
    </>
  );
}
