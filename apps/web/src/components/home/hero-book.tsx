import Image, { type StaticImageData } from 'next/image';

import heroWatercolor from '../../../public/brand/hero-acuarela.webp';

/** Destello de cuatro puntas, decorativo. */
function Sparkle({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 1.5c.7 5.4 3.6 8.4 9 9.5-5.4 1.1-8.3 4.1-9 9.5-.7-5.4-3.6-8.4-9-9.5 5.4-1.1 8.3-4.1 9-9.5z" />
    </svg>
  );
}

/**
 * Libro abierto del hero: la ilustración ocupa la doble página, con el retrato ilustrado del
 * mismo protagonista en un marco tipo polaroid ("Su foto"). Nunca una foto real de un chico.
 */
export function HeroBook({
  alt,
  photoLabel,
  src = heroWatercolor,
}: {
  alt: string;
  photoLabel: string;
  src?: StaticImageData;
}) {
  // Cada página se curva hacia el lomo, como un libro abierto apoyado.
  const half = (side: 'left' | 'right') => (
    <div
      className={`relative h-full w-1/2 overflow-hidden border-[5px] border-[#fffaf3] ${
        side === 'left'
          ? 'origin-right [transform:rotateY(14deg)] rounded-l-[0.9rem] border-r-0'
          : 'origin-left [transform:rotateY(-14deg)] rounded-r-[0.9rem] border-l-0'
      }`}
    >
      <Image
        src={src}
        alt=""
        priority={side === 'left'}
        placeholder="blur"
        sizes="(min-width: 1024px) 640px, 200vw"
        className={`absolute top-0 h-full w-[200%] max-w-none object-cover ${
          side === 'left' ? 'left-0' : '-left-full'
        }`}
      />
      {/* Sombra del lomo: la doble página se curva hacia el centro. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            side === 'left'
              ? 'linear-gradient(to left, rgb(45 28 55 / 0.55), rgb(45 28 55 / 0.22) 6%, rgb(45 28 55 / 0.06) 16%, transparent 30%), linear-gradient(to right, rgb(255 255 255 / 0.3), transparent 10%)'
              : 'linear-gradient(to right, rgb(45 28 55 / 0.5), rgb(45 28 55 / 0.18) 6%, rgb(45 28 55 / 0.05) 16%, transparent 30%), linear-gradient(to left, rgb(255 255 255 / 0.25), transparent 10%)',
        }}
      />
    </div>
  );

  return (
    <figure className="relative isolate mx-auto w-full max-w-[40rem] pt-10 pb-6 lg:pt-14">
      <div
        aria-hidden="true"
        className="absolute inset-x-[-8%] top-[8%] bottom-0 -z-10 rounded-[3rem] bg-[radial-gradient(circle_at_60%_40%,#f3e9f9_0%,#f8e6dc_45%,transparent_72%)] blur-md"
      />
      <Sparkle className="absolute top-4 right-[18%] z-10 size-7 rotate-12 text-star" />
      <Sparkle className="absolute right-0 bottom-2 z-10 size-9 text-star" />

      {/* Libro: páginas apiladas abajo y la doble página levemente inclinada. */}
      <div className="relative [perspective:1800px]">
        <div className="relative origin-bottom [transform:rotateX(9deg)_rotateZ(-2.5deg)] drop-shadow-[0_16px_24px_rgb(80_52_84/0.24)]">
          <div
            aria-hidden="true"
            className="absolute inset-x-[1.5%] -bottom-2.5 h-6 rounded-b-[1rem] bg-[repeating-linear-gradient(180deg,#fffaf3_0_2px,#eadfd6_2px_3px)] shadow-[0_22px_40px_rgb(80_52_84/0.22)]"
          />
          <div
            role="img"
            aria-label={alt}
            className="relative flex aspect-[3/2] [perspective:1100px]"
          >
            {half('left')}
            {half('right')}
          </div>
        </div>
      </div>

      {/* "Su foto": retrato ilustrado del mismo protagonista, no una fotografía. */}
      <div className="absolute top-0 left-[-2%] z-20 w-[30%] min-w-[7.5rem] -rotate-6 rounded-[0.35rem] bg-white p-[3.5%] pb-0 shadow-[0_14px_30px_rgb(55_37_75/0.2)] sm:left-[-6%]">
        <div className="relative aspect-square overflow-hidden rounded-[0.15rem]">
          <Image
            src={src}
            alt=""
            sizes="200px"
            className="absolute inset-0 h-full w-full scale-[2.1] object-cover [object-position:43%_32%]"
          />
        </div>
        <figcaption className="py-2 text-center font-display text-[clamp(0.85rem,1.4vw,1.05rem)] text-foreground/80 italic">
          {photoLabel}
        </figcaption>
      </div>
      {/* Flecha dibujada a mano: de la foto al cuento. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 120 80"
        className="absolute top-[2%] left-[27%] z-20 w-[18%] text-primary"
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
