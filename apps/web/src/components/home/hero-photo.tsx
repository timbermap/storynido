import { ImageSlot } from '@/components/landing/image-slot';

/** Hero con una sola foto horizontal (Home y Profesionales): una foto real, no una ilustración. */
export function HeroPhoto({
  src,
  alt,
  width,
  height,
  tone,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  tone?: string;
}) {
  return (
    <figure className="mx-auto w-full max-w-[40rem] lg:max-w-none">
      <div className="overflow-hidden rounded-[2rem] shadow-[0_30px_60px_-24px_rgb(38_50_74/0.35)]">
        <ImageSlot
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority
          sizes="(min-width: 1024px) 640px, 92vw"
          tone={tone}
        />
      </div>
    </figure>
  );
}

/** Hero de Familias: la página del cuento y, encima, la foto de quien se ve en el libro. */
export function HeroFamilias({ pageAlt, photoAlt }: { pageAlt: string; photoAlt: string }) {
  return (
    <figure className="relative mx-auto w-full max-w-[30rem] pb-8 lg:max-w-[34rem]">
      <div className="ml-auto w-[88%] overflow-hidden rounded-[2rem] shadow-[0_30px_60px_-24px_rgb(38_50_74/0.35)]">
        <ImageSlot
          src="/images/heroes/familias-pagina.webp"
          alt={pageAlt}
          width={1200}
          height={1500}
          priority
          sizes="(min-width: 1024px) 480px, 80vw"
          tone="bg-[#f0dcae]"
        />
      </div>
      <div className="absolute bottom-0 left-0 w-[38%] -rotate-3 overflow-hidden rounded-full border-[6px] border-white shadow-[0_22px_44px_rgb(38_50_74/0.28)]">
        <ImageSlot
          src="/images/heroes/familias-foto.webp"
          alt={photoAlt}
          width={600}
          height={600}
          sizes="(min-width: 1024px) 200px, 34vw"
          tone="bg-[#f4a493]"
        />
      </div>
    </figure>
  );
}

/** Hero de Celebraciones: las cuatro piezas del kit, impresas, con el mismo protagonista. */
export function HeroKit({
  alts,
}: {
  alts: Record<'invitation' | 'book' | 'stickers' | 'bookmarks', string>;
}) {
  // Una sola foto del kit completo; el alt resume las piezas.
  const alt = [alts.invitation, alts.book, alts.stickers, alts.bookmarks].join(' · ');
  return (
    <HeroPhoto
      src="/images/heroes/kit-completo.webp"
      alt={alt}
      width={1600}
      height={1200}
      tone="bg-[#ffe7df]"
    />
  );
}

/**
 * Hero de la home: de la foto al libro. El libro impreso de fondo y, encima, dos polaroids pegadas
 * con cinta: la foto del chico y, al lado, su personaje dibujado (DECISIONS 189). Las dos imágenes
 * de arriba son de muestra hasta tener fotos reales.
 */
export function HeroScene({
  bookAlt,
  photoAlt,
  characterAlt,
  photoLabel,
  characterLabel,
}: {
  bookAlt: string;
  photoAlt: string;
  characterAlt: string;
  photoLabel: string;
  characterLabel: string;
}) {
  const polaroid =
    'absolute top-0 z-10 w-[34%] bg-white p-[2.2%] pb-[7%] shadow-[0_16px_28px_-10px_rgb(38_50_74/0.5)] rounded-lg';
  const tape =
    'absolute -top-[4%] left-1/2 h-[9%] w-[30%] -translate-x-1/2 -rotate-3 rounded-sm bg-[#f7b5a4]/85';
  return (
    <figure className="relative mx-auto w-full max-w-[40rem] pt-[20%] lg:max-w-none">
      <div className={`${polaroid} left-[10%] -rotate-[5deg]`}>
        <span aria-hidden="true" className={tape} />
        <ImageSlot
          src="/images/secciones/foto-real.webp"
          alt={photoAlt}
          width={900}
          height={900}
          sizes="(min-width: 1024px) 200px, 30vw"
          tone="bg-[#f4a493]"
          className="rounded-[3px]"
        />
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-[1%] text-center font-script text-[clamp(1.05rem,2vw,1.5rem)] leading-none"
        >
          {photoLabel}
        </span>
      </div>
      <span
        aria-hidden="true"
        className="absolute top-[6%] left-[46.5%] z-10 text-3xl font-bold text-[#a33f33]"
      >
        →
      </span>
      <div className={`${polaroid} left-[52%] rotate-[4deg]`}>
        <span aria-hidden="true" className={tape} />
        <ImageSlot
          src="/images/secciones/personaje.webp"
          alt={characterAlt}
          width={900}
          height={900}
          sizes="(min-width: 1024px) 200px, 30vw"
          tone="bg-[#fff1e6]"
          className="rounded-[3px]"
        />
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-[1%] text-center font-script text-[clamp(1.05rem,2vw,1.5rem)] leading-none"
        >
          {characterLabel}
        </span>
      </div>
      <div className="relative overflow-hidden rounded-[2rem] shadow-[0_30px_60px_-24px_rgb(38_50_74/0.35)]">
        <ImageSlot
          src="/images/heroes/libro-impreso.webp"
          alt={bookAlt}
          width={1400}
          height={1045}
          priority
          sizes="(min-width: 1024px) 640px, 92vw"
          tone="bg-[#e9dcc3]"
        />
      </div>
    </figure>
  );
}
