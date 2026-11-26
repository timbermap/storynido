import { ArrowRight, Camera, Mail, Receipt, Truck } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { BOOK_LENGTHS, type Locale } from '@storynido/shared';

import { FormatImage } from '@/components/formats/format-showcase';
import { LANDING_FORMAT_IMAGES } from '@/components/home/format-gallery';
import { StartFreeLink } from '@/components/how-it-works/start-free-link';
import { ShowcaseCover } from '@/components/stories/showcase-book';
import { LandingFinalCta, LandingSteps, ctaClass } from '@/components/landing/sections';
import { FAMILY_STEP_VISUALS } from '@/components/landing/step-visuals';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { formatPrice } from '@/lib/format';
import { canOrderPrinted, printFormatsOnSale } from '@/lib/offer';
import { localizedAlternates } from '@/lib/seo';
import { getEventPricing, getOffer, getShowcase } from '@/lib/server/api';
import { getDisplayCountry } from '@/lib/server/request-context';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: 'HowItWorks' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: localizedAlternates(locale, () => '/how-it-works'),
  };
}

const PRINTED = ['softcover', 'hardcover', 'booklet'] as const;

/**
 * Cómo funciona (DECISIONS 251): la página del menú, antes un ancla de la home. Responde lo que
 * frena a quien llega (qué recibo, cuánto cuesta, cuándo llega, qué pasa con la foto) en cuatro
 * bloques cortos y termina en «Empezar gratis». Los precios salen de la oferta del país (los mismos
 * que cobra el checkout) y el impreso figura como «Muy pronto» hasta que el país lo pueda pedir.
 */
export default async function HowItWorksPage({ params }: Props) {
  const locale = (await params).locale as Locale;
  const display = await getDisplayCountry(locale);
  const [t, tLengths, tFormats, offer, kitPricing, showcase, tShowcase] = await Promise.all([
    getTranslations('HowItWorks'),
    getTranslations('Wizard.book.lengths'),
    getTranslations('Home.formats'),
    getOffer(display.country, locale),
    getEventPricing(display.country),
    getShowcase(locale),
    getTranslations('Showcase'),
  ]);

  const money = (minor: number) =>
    formatPrice(minor, offer?.currency ?? 'USD', locale, display.country);
  // El ebook por extensión: solo cuentos (las actividades sueltas se ven al elegirlas).
  const ebookPrices = offer?.available
    ? BOOK_LENGTHS.flatMap((length) => {
        const item = offer.lengthPrices.find(
          (price) => price.length === length && (price.contentType ?? 'story') === 'story',
        );
        return item ? [{ length, price: money(item.amountMinor) }] : [];
      })
    : [];
  // El kit más simple que se puede pagar: el diseño del personaje con la invitación.
  const kitFrom =
    kitPricing?.active && kitPricing.pieces.invitation !== undefined
      ? formatPrice(
          kitPricing.designMinor + kitPricing.pieces.invitation,
          kitPricing.currency,
          locale,
          display.country,
        )
      : null;
  const printFormats = printFormatsOnSale(offer);
  const printAvailable = canOrderPrinted(offer);
  const taxIncluded = offer?.taxIncludedInPrice ?? false;

  const cta = (track: string, className = ctaClass) => (
    <StartFreeLink
      label={t('cta')}
      memberLabel={t('ctaMember')}
      track={track}
      className={className}
    />
  );

  const steps = [
    { title: t('steps.1.title'), text: t('steps.1.text') },
    { title: t('steps.2.title'), text: t('steps.2.text') },
    { title: t('steps.3.title'), text: t('steps.3.text') },
  ];

  const delivery = [
    { icon: Mail, title: t('delivery.digitalTitle'), text: t('delivery.digitalText') },
    // Sin impresos a la venta (PRINT_ENABLED apagado) no se nombra el impreso ni su «muy pronto».
    ...(printAvailable
      ? [
          {
            icon: Truck,
            title: t('delivery.printTitle'),
            text:
              offer && offer.shipping.etaDaysMax > 0
                ? t('delivery.printText', {
                    min: offer.shipping.etaDaysMin,
                    max: offer.shipping.etaDaysMax,
                  })
                : t('delivery.printTextNoEta'),
          },
        ]
      : []),
    {
      icon: Receipt,
      title: t('delivery.pricesTitle'),
      text: taxIncluded ? t('delivery.pricesTextTax') : t('delivery.pricesText'),
    },
    { icon: Camera, title: t('delivery.photosTitle'), text: t('delivery.photosText') },
  ];

  return (
    <>
      {/* Arriba: la promesa en una línea y el botón. */}
      <section className="overflow-hidden">
        <div className="container-page max-w-3xl pt-12 pb-10 text-center lg:pt-16">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            {t('kicker')}
          </p>
          <h1 className="mt-4 text-[clamp(2.3rem,4.2vw,3.6rem)] leading-[1.06] font-medium tracking-[-0.02em]">
            {t('title')}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[clamp(1.1rem,1.6vw,1.25rem)] leading-relaxed text-muted-foreground">
            {t('lead')}
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            {cta(
              'how_cta_top',
              buttonVariants({
                size: 'lg',
                className: 'h-14 w-full rounded-full px-8 text-lg sm:w-auto',
              }),
            )}
            <a
              href="#precios"
              className="border-b-2 border-foreground/25 px-1 pb-0.5 font-display text-lg font-semibold transition-colors hover:border-primary hover:text-primary"
            >
              {t('seePrices')}
            </a>
          </div>
          <p className="mt-4 text-sm font-bold text-muted-foreground">{t('note')}</p>
        </div>
      </section>

      {/* Los tres pasos, con su imagen y el botón para empezar debajo. */}
      <LandingSteps
        tone="mint"
        title={t('stepsTitle')}
        steps={steps}
        visuals={FAMILY_STEP_VISUALS}
        cta={cta('how_cta_steps')}
      />

      {/* Así queda un libro real (DECISIONS 348): solo cuando la mesa aprobó suficientes. */}
      {showcase.length > 0 && (
        <section aria-labelledby="ejemplos-title" className="bg-white">
          <div className="container-page py-16 lg:py-20">
            <h2
              id="ejemplos-title"
              className="text-center text-[clamp(1.8rem,3vw,2.5rem)] leading-[1.1] font-medium"
            >
              {tShowcase('title')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
              {tShowcase('howText')}
            </p>
            <ul className="mx-auto mt-10 grid max-w-5xl grid-cols-2 gap-5 md:grid-cols-4">
              {showcase.slice(0, 4).map((book) => (
                <li key={book.id}>
                  <Link
                    href={{
                      pathname: '/stories/[slug]',
                      params: { slug: book.storySlug },
                      hash: 'asi-queda',
                    }}
                    className="group grid gap-2"
                  >
                    <ShowcaseCover book={book} />
                    <span className="text-sm font-semibold text-primary group-hover:underline">
                      {tShowcase('seeBook')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Qué recibes y cuánto cuesta: lo que hoy se vende, con el precio real del país. */}
      <section id="precios" aria-labelledby="precios-title" className="scroll-mt-28 bg-white">
        <div className="container-page py-16 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2
              id="precios-title"
              className="text-[clamp(1.8rem,3vw,2.5rem)] leading-[1.1] font-medium"
            >
              {t('prices.title')}
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              {printAvailable ? t('prices.subtitlePrint') : t('prices.subtitle')}
            </p>
          </div>

          <ul className="mt-10 grid gap-6 md:grid-cols-2">
            <li className="flex flex-col overflow-hidden rounded-[1.75rem] border bg-card shadow-[var(--shadow-card)]">
              <FormatImage
                src={LANDING_FORMAT_IMAGES.ebook}
                alt={tFormats('ebook.alt')}
                caption={tFormats('caption')}
                sizes="(min-width: 768px) 560px, 92vw"
              />
              <div className="flex flex-1 flex-col gap-2 p-6 font-sans">
                <span className="w-fit rounded-full bg-mint px-3 py-1 text-xs leading-none font-bold text-success">
                  {tFormats('available')}
                </span>
                <h3 className="font-display text-2xl leading-tight font-semibold">
                  {t('prices.ebookName')}
                </h3>
                <p className="font-serif text-muted-foreground">{t('prices.ebookText')}</p>
                {ebookPrices.length > 0 ? (
                  <dl className="mt-3 divide-y rounded-2xl border">
                    {ebookPrices.map(({ length, price }) => (
                      <div
                        key={length}
                        className="flex items-baseline justify-between gap-4 px-4 py-2.5"
                      >
                        <dt>
                          <span className="font-semibold">{tLengths(`${length}.name`)}</span>
                          <span className="block text-sm text-muted-foreground">
                            {tLengths(`${length}.text`)}
                          </span>
                        </dt>
                        <dd className="shrink-0 font-bold">{price}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-3 font-semibold">{t('prices.inCreator')}</p>
                )}
              </div>
            </li>

            <li className="flex flex-col overflow-hidden rounded-[1.75rem] border bg-card shadow-[var(--shadow-card)]">
              <FormatImage
                src={LANDING_FORMAT_IMAGES.kit}
                alt={tFormats('kit.alt')}
                caption={tFormats('caption')}
                sizes="(min-width: 768px) 560px, 92vw"
              />
              <div className="flex flex-1 flex-col gap-2 p-6 font-sans">
                <span className="w-fit rounded-full bg-mint px-3 py-1 text-xs leading-none font-bold text-success">
                  {tFormats('available')}
                </span>
                <h3 className="font-display text-2xl leading-tight font-semibold">
                  {tFormats('kit.name')}
                </h3>
                <p className="font-serif text-muted-foreground">{t('prices.kitText')}</p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                  {kitFrom && (
                    <span className="font-bold">{t('prices.from', { price: kitFrom })}</span>
                  )}
                  <Link
                    href="/events"
                    data-track="how_kit"
                    className="inline-flex items-center gap-1.5 font-bold text-primary"
                  >
                    {tFormats('kit.cta')}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </li>
          </ul>

          {printAvailable && (
            <>
              {/* Impresos: una fila chica, sin precios hasta que se puedan pedir. */}
              <h3 className="mt-12 text-center font-display text-xl font-semibold">
                {tFormats('printTitleReady')}
              </h3>
              <ul className="mx-auto mt-5 grid max-w-3xl grid-cols-3 gap-3 sm:gap-5">
                {PRINTED.map((format) => (
                  <li key={format}>
                    <figure className="h-full overflow-hidden rounded-[1.25rem] border bg-card">
                      <FormatImage
                        src={LANDING_FORMAT_IMAGES[format]}
                        alt={tFormats(`${format}.alt`)}
                        caption={tFormats('caption')}
                        sizes="(min-width: 640px) 240px, 30vw"
                      />
                      <figcaption className="grid gap-1 p-3 font-sans sm:p-4">
                        <span className="font-display text-sm font-semibold sm:text-base">
                          {tFormats(`${format}.name`)}
                        </span>
                        <span className="text-xs font-bold text-muted-foreground">
                          {printFormats.includes(format) ? tFormats('available') : tFormats('soon')}
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

      {/* Entrega, precios y fotos: lo que se pregunta antes de pagar, en cuatro respuestas. */}
      <section aria-labelledby="entrega-title" className="bg-mint-soft">
        <div className="container-page py-16 lg:py-20">
          <h2
            id="entrega-title"
            className="text-center text-[clamp(1.8rem,3vw,2.5rem)] leading-[1.1] font-medium"
          >
            {t('delivery.title')}
          </h2>
          <ul className="mx-auto mt-10 grid max-w-5xl gap-5 sm:grid-cols-2">
            {delivery.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4 rounded-[1.5rem] bg-card p-6">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                  <Icon className="size-6" strokeWidth={1.6} aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-display text-lg font-semibold">{title}</span>
                  <span className="mt-1 block text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-center text-muted-foreground">
            {t.rich('delivery.more', {
              faq: (chunks) => (
                <Link
                  href="/faq"
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      </section>

      <LandingFinalCta title={t('finalTitle')} text={t('finalText')} cta={cta('how_cta_bottom')} />
    </>
  );
}
