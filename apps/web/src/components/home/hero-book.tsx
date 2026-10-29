import Image, { type StaticImageData } from 'next/image';

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
export function HeroBook({
  alt,
  photoLabel,
  image = heroBook,
}: {
  alt: string;
  photoLabel: string;
  /** Ilustración principal (por defecto, el libro abierto de la home). */
  image?: StaticImageData;
}) {
  return (
    <figure className="relative isolate mx-auto w-full max-w-[40rem] pt-2 pb-6 lg:max-w-none">
      <Sparkle className="absolute top-[34%] right-[2%] z-10 size-7 rotate-12 text-star" />
      <Sparkle className="absolute right-[6%] bottom-[2%] z-10 size-9 text-star" />

      {/* El libro, más abajo y a la derecha: la foto va encima, bien grande. */}
      <div className="mt-[20%] ml-auto w-[84%] overflow-hidden rounded-[2rem] shadow-[0_30px_60px_-24px_rgb(38_50_74/0.35)]">
        <Image
          src={image}
          alt={alt}
          priority
          placeholder="blur"
          sizes="(min-width: 1024px) 640px, 90vw"
          className="h-auto w-full"
        />
      </div>

      {/* "Su foto": retrato ilustrado del mismo protagonista, no una fotografía. */}
      <div className="absolute top-0 left-0 z-20 w-[46%] -rotate-3 rounded-[0.4rem] bg-white p-[2.5%] pb-0 shadow-[0_22px_44px_rgb(38_50_74/0.28)]">
        <Image
          src={heroPortrait}
          alt=""
          sizes="(min-width: 1024px) 380px, 46vw"
          className="aspect-square h-auto w-full rounded-[0.2rem]"
        />
        <figcaption className="py-2 text-center font-script text-[clamp(1.5rem,2.6vw,2.1rem)] leading-none text-navy">
          {photoLabel}
        </figcaption>
      </div>
      {/* Flecha dibujada a mano: de la foto al cuento. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 120 80"
        className="absolute top-[14%] left-[46%] z-20 w-[18%] text-primary"
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
