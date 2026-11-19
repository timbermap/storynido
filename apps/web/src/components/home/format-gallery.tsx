import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { BookFormat } from '@storynido/shared';

import { FormatImage } from '@/components/formats/format-showcase';
import { Link } from '@/i18n/navigation';

/**
 * «Así lo recibes» en la home (DECISIONS 249): primero lo que hoy se puede comprar (el ebook y el
 * kit de Celebraciones, los dos digitales) y debajo los impresos como «Muy pronto» hasta que el
 * país los pueda pedir. Las fotos son ilustrativas y muestran a Tomás, el personaje inventado de la
 * home: ningún niño real.
 */
export const LANDING_FORMAT_IMAGES = {
  ebook: '/images/formatos/landing-ebook.webp',
  kit: '/images/formatos/landing-kit.webp',
  softcover: '/images/formatos/landing-tapa-blanda.webp',
  hardcover: '/images/formatos/landing-tapa-dura.webp',
  booklet: '/images/formatos/landing-grapado.webp',
} as const;

const PRINTED = ['softcover', 'hardcover', 'booklet'] as const;

export async function FormatGallery({
  printFormats,
  digitalPrice,
}: {
  /** Impresos que de verdad se pueden pedir en el país (vacío: todos «Muy pronto»). */
  printFormats: readonly BookFormat[];
  digitalPrice: string | null;
}) {
  const t = await getTranslations('Home.formats');
  const caption = t('caption');
  const anyPrint = PRINTED.some((format) => printFormats.includes(format));
  const available = (
    <span className="w-fit rounded-full bg-mint px-3 py-1 text-xs leading-none font-bold text-success">
      {t('available')}
    </span>
  );
  const soon = (
    <span className="w-fit rounded-full bg-butter px-3 py-1 text-xs leading-none font-bold text-foreground">
      {t('soon')}
    </span>
  );
  const digital = [
    {
      key: 'ebook',
      href: '/families',
      track: 'home_format_ebook',
      price: digitalPrice ? t('ebook.price', { price: digitalPrice }) : null,
    },
    { key: 'kit', href: '/events', track: 'home_format_kit', price: null },
  ] as const;

  return (
    <section aria-labelledby="formats" className="bg-white">
      <div className="container-page py-20 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="formats" className="text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium">
            {t('title')}
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            {anyPrint ? t('subtitlePrint') : t('subtitle')}
          </p>
        </div>

        <ul className="mt-12 grid gap-6 md:grid-cols-2">
          {digital.map(({ key, href, track, price }) => (
            <li key={key}>
              <Link
                href={href}
                data-track={track}
                className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-0.5"
              >
                <FormatImage
                  src={LANDING_FORMAT_IMAGES[key]}
                  alt={t(`${key}.alt`)}
                  caption={caption}
                  sizes="(min-width: 768px) 560px, 92vw"
                />
                <span className="flex flex-1 flex-col gap-2 p-6 font-sans">
                  {available}
                  <span className="font-display text-2xl leading-tight font-semibold">
                    {t(`${key}.name`)}
                  </span>
                  <span className="font-serif text-muted-foreground">{t(`${key}.text`)}</span>
                  <span className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                    {price && <span className="font-bold">{price}</span>}
                    <span className="inline-flex items-center gap-1.5 font-bold text-primary">
                      {t(`${key}.cta`)}
                      <ArrowRight
                        className="size-4 transition group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* Los impresos solo se muestran cuando el país puede pedirlos (PRINT_ENABLED). */}
        {anyPrint && (
          <>
            <h3 className="mt-14 text-center font-display text-2xl font-semibold">
              {t('printTitleReady')}
            </h3>
            <ul className="mt-6 grid gap-5 sm:grid-cols-3">
              {PRINTED.map((format) => (
                <li key={format}>
                  <figure className="h-full overflow-hidden rounded-[1.5rem] border bg-card">
                    <FormatImage
                      src={LANDING_FORMAT_IMAGES[format]}
                      alt={t(`${format}.alt`)}
                      caption={caption}
                      sizes="(min-width: 640px) 360px, 92vw"
                    />
                    <figcaption className="grid gap-1.5 p-5 font-sans">
                      {printFormats.includes(format) ? available : soon}
                      <span className="font-display text-lg font-semibold">
                        {t(`${format}.name`)}
                      </span>
                      <span className="font-serif text-sm text-muted-foreground">
                        {t(`${format}.text`)}
                      </span>
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
