import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { ChristmasDeadline } from '@/components/stories/christmas-deadline';
import { HeroScene } from '@/components/home/hero-photo';
import { HeroFacts } from '@/components/home/hero-facts';
import { FormatGallery } from '@/components/home/format-gallery';
import { FaqList, faqHighlights, parseFaqGroups } from '@/components/home/faq-list';
import { AudienceSelector } from '@/components/landing/audience-selector';
import { LandingFinalCta, LandingSteps, ctaClass } from '@/components/landing/sections';
import { FAMILY_STEP_VISUALS } from '@/components/landing/step-visuals';
import { JsonLd } from '@/components/json-ld';
import { FAQ_ID, HOW_IT_WORKS_ID } from '@/components/layout/site-header';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { CONTACT_ID } from '@/components/home/contact-form';
import { brand } from '@/lib/brand';
import { SignedInHome } from '@/components/home/session/signed-in-home';
import { homeLineCopy } from '@/components/home/session/line-copy';
import { getContent, getOffer, getStories } from '@/lib/server/api';
import { SESSION_COOKIE } from '@/lib/session-hint';
import { getDisplayCountry } from '@/lib/server/request-context';
import { canOrderPrinted, offerHighlights, printFormatsOnSale } from '@/lib/offer';
import { SITE_URL, absoluteUrl } from '@/lib/site';
import { StartStoryLink } from '@/components/auth/start-story-link';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;

  const display = await getDisplayCountry(locale);

  // Quien ya tiene sesión (la marca la escribe el navegador al entrar, DECISIONS 110) ve su propia
  // home desde el primer pintado, sin el parpadeo de la landing de visitante. La marca no es la
  // sesión: sus datos los lee el navegador con su sesión de Firebase.
  if ((await cookies()).get(SESSION_COOKIE)?.value === '1') {
    const [offer, stories, lines] = await Promise.all([
      getOffer(display.country, locale),
      // Todas las líneas: las portadas de catálogo ilustran borradores de cualquier línea.
      getStories(locale).catch(() => []),
      homeLineCopy(),
    ]);
    return (
      <SignedInHome
        stories={stories}
        offer={offer}
        country={display.country}
        lines={lines}
        christmas={
          <ChristmasDeadline
            offer={offer}
            country={display.country}
            locale={locale}
            variant="line"
          />
        }
      />
    );
  }

  const [t, faq, offer] = await Promise.all([
    getTranslations('Home'),
    getContent('faq', locale).catch(() => null),
    getOffer(display.country, locale),
  ]);
  const highlights = offerHighlights(offer, locale, display.country);
  // Sin impreso en el país (hoy staging vende solo digital) no se promete tapa dura ni envío.
  const printFormats = printFormatsOnSale(offer);
  const printAvailable = canOrderPrinted(offer);
  // Solo las destacadas: todas las preguntas y el contacto están en /faq.
  const faqItems = faq ? faqHighlights(parseFaqGroups(faq.body)) : [];

  // Los tres pasos (la imagen de cada uno está en FAMILY_STEP_VISUALS).
  const steps = [
    {
      title: t('how.step1Title'),
      text: t('how.step1Text'),
    },
    {
      title: t('how.step2Title'),
      text: t('how.step2Text'),
    },
    {
      title: t('how.step3Title'),
      text: printAvailable ? t('how.step3Text') : t('how.step3TextDigital'),
    },
  ];

  return (
    <>
      {/* Fecha límite del impreso para Navidad (de mediados de octubre al 23 de diciembre). */}
      <div className="container-page pt-4 empty:hidden">
        <ChristmasDeadline offer={offer} country={display.country} locale={locale} />
      </div>
      {/* Hero. En el celular el orden cambia (DECISIONS 250): título, imagen y botón en la primera
          pantalla; el texto y los datos debajo. En escritorio, texto a la izquierda e imagen a la derecha. */}
      <section className="overflow-hidden">
        <div className="container-page grid items-center gap-5 pt-6 pb-10 text-center lg:grid-cols-[1fr_1.05fr] lg:gap-12 lg:pt-12 lg:pb-16 lg:text-left">
          <div className="contents lg:block">
            <p className="order-1 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase lg:order-none">
              {t('hero.homeKicker')}
            </p>
            <h1 className="order-2 text-[clamp(2.25rem,4vw,3.9rem)] leading-[1.04] font-medium tracking-[-0.025em] lg:order-none lg:mt-5">
              {t.rich('hero.homeHeadline', {
                br: () => <br />,
                hl: (chunks) => <span className="text-primary">{chunks}</span>,
              })}
            </h1>
            <p className="order-5 mx-auto max-w-xl text-[clamp(1.1rem,1.6vw,1.3rem)] leading-relaxed text-muted-foreground lg:order-none lg:mx-0 lg:mt-6">
              {printAvailable ? t('hero.homeLead') : t('hero.homeLeadDigital')}
            </p>
            <p className="order-6 font-script text-[clamp(1.6rem,2.4vw,2.1rem)] leading-tight text-primary lg:order-none lg:mt-4">
              {t('hero.script')}
            </p>
            <div className="order-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:order-none lg:mt-9 lg:justify-start lg:gap-5">
              <StartStoryLink
                target="audience"
                memberLabel={t('hero.homeMember')}
                continueLabel={t('hero.homeContinue')}
                className={buttonVariants({
                  size: 'lg',
                  className: 'h-14 w-full rounded-full px-8 text-lg sm:w-auto',
                })}
              >
                {t('hero.homeCta')}
              </StartStoryLink>
              {/* Para quien prefiere mirar primero: el catálogo completo. */}
              <Link
                href="/families/stories"
                data-track="home_explore"
                className="border-b-2 border-foreground/25 px-1 pb-0.5 font-display text-lg font-semibold transition-colors hover:border-primary hover:text-primary"
              >
                {t('hero.exploreStories')}
              </Link>
            </div>
            <div className="order-7 lg:order-none">
              <HeroFacts
                digitalPrice={highlights?.digital ?? null}
                printAvailable={printAvailable}
              />
            </div>
          </div>
          {/* En el celular, más chica para que entren el título, la imagen y el botón. */}
          <div className="order-3 mx-auto w-full max-w-[19rem] sm:max-w-[30rem] lg:order-none lg:max-w-none">
            <HeroScene
              bookAlt={t('hero.sceneBookAlt')}
              photoAlt={t('hero.scenePhotoAlt')}
              characterAlt={t('hero.sceneCharacterAlt')}
              photoLabel={t('hero.scenePhotoLabel')}
              characterLabel={t('hero.sceneCharacterLabel')}
              caption={t('formats.caption')}
            />
          </div>
        </div>
      </section>

      <AudienceSelector />

      {/* Cómo funciona: cada paso con su imagen y, debajo, el botón para empezar. */}
      <LandingSteps
        id={HOW_IT_WORKS_ID}
        tone="mint"
        title={t('how.title')}
        subtitle={t('how.subtitle')}
        steps={steps}
        visuals={FAMILY_STEP_VISUALS}
        cta={
          <StartStoryLink
            target="audience"
            memberLabel={t('hero.homeMember')}
            continueLabel={t('hero.homeContinue')}
            className={ctaClass}
          >
            {t('hero.homeCta')}
          </StartStoryLink>
        }
      />

      {/* Así lo recibes: lo digital que hoy se vende y los impresos que llegan pronto. */}
      <FormatGallery printFormats={printFormats} digitalPrice={highlights?.digital ?? null} />

      {/* Preguntas frecuentes */}
      {faqItems.length > 0 && (
        <section id={FAQ_ID} className="scroll-mt-28">
          <div className="container-page grid gap-10 py-20 lg:grid-cols-[1fr_1.6fr] lg:gap-16 lg:py-24">
            <div>
              <h2 className="text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium">
                {t('faq.title')}
              </h2>
              <p className="mt-4 max-w-sm text-muted-foreground">
                {t.rich('faq.contact', {
                  form: (chunks) => (
                    <Link
                      href={{ pathname: '/faq', hash: CONTACT_ID }}
                      className="font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            </div>
            <div>
              <FaqList items={faqItems} />
              <Link
                href="/faq"
                className="mt-6 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
              >
                {t('faq.more')} →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Llamado final: el mismo cierre en las cuatro landings */}
      <LandingFinalCta
        title={t('finalCta.title')}
        text={t('finalCta.text')}
        cta={
          <StartStoryLink
            target="audience"
            memberLabel={t('hero.homeMember')}
            continueLabel={t('hero.homeContinue')}
            className={ctaClass}
          >
            {t('hero.homeCta')}
          </StartStoryLink>
        }
      />
      {/* Datos para buscadores (schema.org), después del contenido visible. */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: brand.name,
          url: SITE_URL,
          logo: absoluteUrl('/icon.svg'),
        }}
      />
    </>
  );
}
