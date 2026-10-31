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
