import Image from 'next/image';
import { useTranslations } from 'next-intl';

import type { BookFormat } from '@storynido/shared';

import { cn } from '@/lib/utils';

/**
 * Imágenes de lo que se recibe (DECISIONS 248 y 253). Todas son ilustrativas y con Tomás, el
 * personaje inventado: nunca un libro hecho con la foto de un niño real.
 */
export const FORMAT_IMAGES = {
  ebook: '/images/formatos/landing-ebook.webp',
  printed: '/images/formatos/landing-tapa-dura.webp',
  booklet: '/images/formatos/landing-grapado.webp',
} as const;

export const TYPE_IMAGES = {
  story: '/images/formatos/tipo-cuento.webp',
  story_activities: '/images/formatos/tipo-cuento-actividades.webp',
  coloring: '/images/formatos/tipo-colorear.webp',
  activities: '/images/formatos/tipo-actividades.webp',
} as const;

/** Rótulo chico en la esquina de cada foto o composición que no es un pedido real. */
export function IllustrativeCaption({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        'pointer-events-none absolute right-1.5 bottom-1.5 rounded-full bg-white/85 px-1.5 py-0.5 font-sans text-[0.55rem] leading-tight font-bold text-foreground sm:right-2 sm:bottom-2 sm:px-2 sm:text-[0.65rem]',
        className,
      )}
    >
      {label}
    </span>
  );
}

/** Imagen 4:3 de la carpeta de formatos, con su rótulo «Imagen ilustrativa». */
export function FormatImage({
  src,
  alt,
  caption,
  sizes,
  className,
}: {
  src: string;
  alt: string;
  caption: string;
  sizes: string;
  className?: string;
}) {
  return (
    <span className={cn('relative block aspect-[4/3] overflow-hidden bg-muted', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        loading="lazy"
        unoptimized
        className="object-cover"
      />
      <IllustrativeCaption label={caption} />
    </span>
  );
}

type ShowcasePiece = keyof typeof FORMAT_IMAGES;

/**
 * Lo que entrega cada formato: el ebook es solo el PDF; un impreso trae el libro y también el PDF
 * (decisión de Sebas, DECISIONS 256). El worker siempre maqueta el PDF digital y se descarga
 * desde el pedido también en los impresos.
 */
export function deliveredPieces(format: BookFormat): ShowcasePiece[] {
  if (format === 'digital') return ['ebook'];
  return [format === 'booklet' ? 'booklet' : 'printed', 'ebook'];
}

/**
 * Piezas que se ven en «Así lo recibes»: siempre el ebook (el formato por defecto de Familias) y,
 * solo si el país de verdad los vende, el libro impreso y el cuento grapado. Nada de «Muy pronto»
 * en el flujo de compra: los impresos que vienen se anuncian en la home (DECISIONS 253).
 */
export function showcasePieces(printFormats: readonly BookFormat[]): ShowcasePiece[] {
  const pieces = new Set<ShowcasePiece>(deliveredPieces('digital'));
  for (const format of printFormats) {
    if (format !== 'digital') for (const piece of deliveredPieces(format)) pieces.add(piece);
  }
  const order: ShowcasePiece[] = ['ebook', 'printed', 'booklet'];
  return order.filter((piece) => pieces.has(piece));
}

/**
 * «Así lo recibes»: lo que la persona recibe con el formato del libro. Con solo el ebook a la
 * venta, una sola tarjeta (horizontal en pantallas anchas); con impresos a la venta, una por pieza,
 * y cada impreso avisa que trae también el PDF.
 */
export function FormatShowcase({
  printFormats,
  className,
  headingLevel = 'h3',
  headingClassName = 'font-bold',
}: {
  /** Impresos que de verdad se pueden pedir en el país (vacío: solo el ebook). */
  printFormats: readonly BookFormat[];
  className?: string;
  headingLevel?: 'h2' | 'h3';
  headingClassName?: string;
}) {
  const t = useTranslations('FormatShowcase');
  const Heading = headingLevel;
  const pieces = showcasePieces(printFormats);
  const single = pieces.length === 1;

  return (
    <section aria-labelledby="format-showcase" className={cn('grid gap-3 font-sans', className)}>
      <Heading id="format-showcase" className={headingClassName}>
        {t('title')}
      </Heading>
      <div className={cn('grid gap-3', !single && 'sm:grid-cols-2')}>
        {pieces.map((piece) => (
          <figure
            key={piece}
            data-piece={piece}
            className={cn(
              'overflow-hidden rounded-xl border bg-card',
              single && 'sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-center',
            )}
          >
            <FormatImage
              src={FORMAT_IMAGES[piece]}
              alt={t(`${piece}Alt`)}
              caption={t('caption')}
              sizes="(min-width: 640px) 360px, 92vw"
            />
            <figcaption className="grid gap-1 p-4">
              <span className="font-display text-lg font-semibold">{t(`${piece}Name`)}</span>
              <span className="text-sm text-muted-foreground">{t(`${piece}Text`)}</span>
              {piece !== 'ebook' && (
                <span className="mt-1 w-fit rounded-full bg-mint px-2.5 py-1 text-xs leading-none font-bold text-success">
                  {t('includesPdf')}
                </span>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
