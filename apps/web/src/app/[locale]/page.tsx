import { ArrowRight, BookOpen, Map, UserRound } from 'lucide-react';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { ChristmasDeadline } from '@/components/stories/christmas-deadline';
import { HeroScene } from '@/components/home/hero-photo';
import { HeroFacts } from '@/components/home/hero-facts';
import { FaqList, faqHighlights, parseFaqGroups } from '@/components/home/faq-list';
import { AudienceSelector } from '@/components/landing/audience-selector';
import { LandingFinalCta, ctaClass } from '@/components/landing/sections';
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
import { offerHighlights } from '@/lib/offer';
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
  // Solo las destacadas: todas las preguntas y el contacto están en /faq.
  const faqItems = faq ? faqHighlights(parseFaqGroups(faq.body)) : [];

  // Cada paso con su color pastel (número e ícono).
  const steps = [
    {
      icon: UserRound,
      title: t('how.step1Title'),
      text: t('how.step1Text'),
      tone: 'bg-secondary text-primary',
    },
    {
      icon: Map,
      title: t('how.step2Title'),
      text: t('how.step2Text'),
      tone: 'bg-peach text-[#a33f33]',
    },
    {
      icon: BookOpen,
      title: t('how.step3Title'),
      text: t('how.step3Text'),
      tone: 'bg-mint text-success',
    },
  ];

  return (
    <>
      {/* Fecha límite del impreso para Navidad (de mediados de octubre al 23 de diciembre). */}
      <div className="container-page pt-4 empty:hidden">
        <ChristmasDeadline offer={offer} country={display.country} locale={locale} />
      </div>
      {/* Hero */}
      <section className="overflow-hidden">
        <div className="container-page grid items-center gap-8 pt-8 pb-10 lg:grid-cols-[1fr_1.05fr] lg:gap-12 lg:pt-12 lg:pb-16">
          <div className="text-center lg:text-left">
            <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              {t('hero.homeKicker')}
            </p>
            <h1 className="mt-5 text-[clamp(2.5rem,4vw,3.9rem)] leading-[1.04] font-medium tracking-[-0.025em]">
              {t.rich('hero.homeHeadline', {
                br: () => <br />,
                hl: (chunks) => <span className="text-primary">{chunks}</span>,
              })}
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-[clamp(1.1rem,1.6vw,1.3rem)] leading-relaxed text-muted-foreground lg:mx-0">
              {t('hero.homeLead')}
            </p>
            <p className="mt-4 font-script text-[clamp(1.6rem,2.4vw,2.1rem)] leading-tight text-primary">
              {t('hero.script')}
            </p>
            <div className="mt-9 flex flex-col items-center gap-5 sm:flex-row sm:justify-center lg:justify-start">
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
                className="border-b-2 border-foreground/25 px-1 pb-0.5 text-lg font-semibold transition-colors hover:border-primary hover:text-primary"
              >
                {t('hero.exploreStories')}
              </Link>
            </div>
            <HeroFacts digitalPrice={highlights?.digital ?? null} />
          </div>
          <HeroScene
            bookAlt={t('hero.sceneBookAlt')}
            photoAlt={t('hero.scenePhotoAlt')}
            characterAlt={t('hero.sceneCharacterAlt')}
            photoLabel={t('hero.scenePhotoLabel')}
            characterLabel={t('hero.sceneCharacterLabel')}
          />
        </div>
      </section>

      <AudienceSelector />

      {/* Cómo funciona */}
      <section id={HOW_IT_WORKS_ID} className="scroll-mt-28 bg-mint-soft">
        <div className="container-page py-20 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium">
              {t('how.title')}
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">{t('how.subtitle')}</p>
          </div>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-6">
            {steps.map(({ icon: Icon, title, text, tone }, index) => (
              <li key={title} className="relative flex flex-col items-center text-center">
                <div className="relative">
                  <span className="grid size-28 place-items-center rounded-full bg-card shadow-[var(--shadow-card)]">
                    <Icon
                      className="size-11 text-primary/80"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </span>
                  <span
                    className={`absolute -top-1 -left-1 grid size-10 place-items-center rounded-full font-display text-lg font-bold ${tone}`}
                  >
                    {index + 1}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <ArrowRight
                    aria-hidden="true"
                    className="absolute top-12 -right-5 hidden size-7 text-[#e7b9ad] md:block"
                    strokeWidth={1.5}
                  />
                )}
                <h3 className="mt-6 text-2xl leading-tight font-medium">{title}</h3>
                <p className="mt-2 max-w-xs text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

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
