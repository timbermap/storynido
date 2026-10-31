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
  const pieces = [
    ['kit-invitacion', alts.invitation, 'translate-y-4'],
    ['kit-cuento', alts.book, '-translate-y-2'],
    ['kit-stickers', alts.stickers, '-translate-y-2'],
    ['kit-separadores', alts.bookmarks, 'translate-y-4'],
  ] as const;
  return (
    <figure className="mx-auto grid w-full max-w-[40rem] grid-cols-2 gap-3 lg:max-w-none lg:grid-cols-4">
      {pieces.map(([file, alt, shift], index) => (
        <div
          key={file}
          className={`overflow-hidden rounded-2xl shadow-[0_18px_40px_-20px_rgb(38_50_74/0.4)] lg:${shift}`}
        >
          <ImageSlot
            src={`/images/heroes/${file}.webp`}
            alt={alt}
            width={900}
            height={1200}
            priority={index < 2}
            sizes="(min-width: 1024px) 160px, 45vw"
            tone="bg-[#ffe7df]"
          />
        </div>
      ))}
    </figure>
  );
}
