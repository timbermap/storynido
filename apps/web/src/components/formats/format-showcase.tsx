import Image from 'next/image';
import { useTranslations } from 'next-intl';

import type { BookFormat } from '@storynido/shared';

import { cn } from '@/lib/utils';

/**
 * Imágenes de lo que se recibe (DECISIONS 248). Todas son ilustrativas: páginas reales de un cuento
 * de muestra con un personaje inventado, compuestas en un dispositivo, o la foto aprobada del regalo.
 */
export const FORMAT_IMAGES = {
  ebook: '/images/formatos/formato-ebook.webp',
  printed: '/images/formatos/formato-libro-fisico.webp',
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

/**
 * «Así lo recibes»: el ebook y, al lado, el libro impreso. Los impresos que el país no puede pedir
 * se ven como «Muy pronto», sin precio ni opción para elegirlos (hoy staging vende solo digital).
 */
export function FormatShowcase({
  printFormats,
  className,
  headingLevel = 'h3',
  headingClassName = 'font-bold',
}: {
  /** Impresos que de verdad se pueden pedir en el país (vacío: todos «Muy pronto»). */
  printFormats: readonly BookFormat[];
  className?: string;
  headingLevel?: 'h2' | 'h3';
  headingClassName?: string;
}) {
  const t = useTranslations('FormatShowcase');
  const Heading = headingLevel;
  const printReady = printFormats.some(
    (format) => format === 'softcover' || format === 'hardcover',
  );
  const bookletReady = printFormats.includes('booklet');
  const soon = (
    <span className="w-fit rounded-full bg-butter px-2.5 py-1 text-xs leading-none font-bold text-foreground">
      {t('soon')}
    </span>
  );

  return (
    <section aria-labelledby="format-showcase" className={cn('grid gap-3 font-sans', className)}>
      <Heading id="format-showcase" className={headingClassName}>
        {t('title')}
      </Heading>
      <div className="grid gap-3 sm:grid-cols-2">
        <figure className="overflow-hidden rounded-xl border bg-card">
          <FormatImage
            src={FORMAT_IMAGES.ebook}
            alt={t('ebookAlt')}
            caption={t('caption')}
            sizes="(min-width: 640px) 360px, 92vw"
          />
          <figcaption className="grid gap-1 p-4">
            <span className="font-display text-lg font-semibold">{t('ebookName')}</span>
            <span className="text-sm text-muted-foreground">{t('ebookText')}</span>
          </figcaption>
        </figure>
        <figure className="overflow-hidden rounded-xl border bg-card">
          <FormatImage
            src={FORMAT_IMAGES.printed}
            alt={t('printAlt')}
            caption={t('caption')}
            sizes="(min-width: 640px) 360px, 92vw"
          />
          <figcaption className="grid gap-1 p-4">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-display text-lg font-semibold">{t('printName')}</span>
              {!printReady && soon}
            </span>
            <span className="text-sm text-muted-foreground">
              {printReady ? t('printText') : t('printTextSoon')}
            </span>
          </figcaption>
        </figure>
      </div>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-dashed bg-card px-4 py-3 text-sm">
        <span className="font-semibold">{t('bookletName')}</span>
        {!bookletReady && soon}
        <span className="basis-full text-muted-foreground sm:basis-auto">{t('bookletText')}</span>
      </p>
    </section>
  );
}
