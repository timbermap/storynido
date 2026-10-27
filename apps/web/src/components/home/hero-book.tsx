import Image from 'next/image';

import heroBook from '../../../public/brand/hero-libro.webp';
import heroPortrait from '../../../public/brand/hero-retrato.webp';

/** Destello de cuatro puntas, decorativo. */
function Sparkle({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 1.5c.7 5.4 3.6 8.4 9 9.5-5.4 1.1-8.3 4.1-9 9.5-.7-5.4-3.6-8.4-9-9.5 5.4-1.1 8.3-4.1 9-9.5z" />
    </svg>
  );
}

/**
 * Hero: libro abierto con el mismo protagonista en las dos páginas (ilustración generada con
 * IA, niño inventado) y su retrato ilustrado en un marco tipo polaroid ("Su foto").
 * Nunca una foto real de un chico.
 */
export function HeroBook({ alt, photoLabel }: { alt: string; photoLabel: string }) {
  return (
    <figure className="relative isolate mx-auto w-full max-w-[42rem] pt-8 lg:pt-12">
      <Sparkle className="absolute top-2 right-[14%] z-10 size-7 rotate-12 text-star" />
      <Sparkle className="absolute right-[-1%] bottom-[8%] z-10 size-8 text-star" />

      <div className="overflow-hidden rounded-[2rem] shadow-[0_30px_60px_-24px_rgb(52_42_64/0.35)]">
        <Image
          src={heroBook}
          alt={alt}
          priority
          placeholder="blur"
          sizes="(min-width: 1024px) 640px, 100vw"
          className="h-auto w-full"
        />
      </div>

      {/* "Su foto": retrato ilustrado del mismo protagonista, no una fotografía. */}
      <div className="absolute top-0 left-[-3%] z-20 w-[28%] min-w-[7rem] -rotate-6 rounded-[0.35rem] bg-white p-[3%] pb-0 shadow-[0_14px_30px_rgb(52_42_64/0.22)] sm:left-[-7%]">
        <Image
          src={heroPortrait}
          alt=""
          sizes="200px"
          className="aspect-square h-auto w-full rounded-[0.15rem]"
        />
        <figcaption className="py-2 text-center font-display text-[clamp(0.85rem,1.4vw,1.05rem)] text-foreground/80 italic">
          {photoLabel}
        </figcaption>
      </div>
      {/* Flecha dibujada a mano: de la foto al cuento. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 120 80"
        className="absolute top-[1%] left-[24%] z-20 w-[16%] text-primary"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 22c26-20 70-22 92 6 6 8 9 17 9 27" />
        <path d="M95 46l12 12 9-15" />
      </svg>
    </figure>
  );
}
