import { ArrowRight, BookOpen, Map, ShieldCheck, UserRound } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { HeroBook } from '@/components/home/hero-book';
import { HeroFacts } from '@/components/home/hero-facts';
import { FaqGroups, parseFaq, parseFaqGroups } from '@/components/home/faq-list';
import { AudienceSelector } from '@/components/landing/audience-selector';
import { JsonLd } from '@/components/json-ld';
import { FAQ_ID, HOW_IT_WORKS_ID } from '@/components/layout/site-header';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { CONTACT_ID, ContactForm } from '@/components/home/contact-form';
import { brand } from '@/lib/brand';
import { getContent } from '@/lib/server/api';
import { SITE_URL, absoluteUrl } from '@/lib/site';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;

  const [t, tContact, faq] = await Promise.all([
    getTranslations('Home'),
    getTranslations('Contact'),
    getContent('faq', locale).catch(() => null),
  ]);
  const faqItems = faq ? parseFaq(faq.body) : [];
  const faqGroups = faq ? parseFaqGroups(faq.body) : [];

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
      {/* Hero */}
      <section className="overflow-hidden">
        <div className="container-page grid items-center gap-8 pt-8 pb-10 lg:grid-cols-[1fr_1.05fr] lg:gap-12 lg:pt-12 lg:pb-16">
          <div className="text-center lg:text-left">
            <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              {t('hero.kicker')}
            </p>
            <h1 className="mt-5 text-[clamp(2.5rem,4vw,3.9rem)] leading-[1.04] font-medium tracking-[-0.025em]">
              {t.rich('hero.homeHeadline', {
                br: () => <br />,
                hl: (chunks) => <span className="text-primary">{chunks}</span>,
              })}
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-[clamp(1.1rem,1.6vw,1.3rem)] leading-relaxed text-muted-foreground lg:mx-0">
              {t('hero.lead')}
            </p>
            <p className="mt-4 font-script text-[clamp(1.6rem,2.4vw,2.1rem)] leading-tight text-primary">
              {t('hero.script')}
            </p>
            <div className="mt-9 flex flex-col items-center gap-5 sm:flex-row sm:justify-center lg:justify-start">
              <a
                href="#audience"
                className={buttonVariants({
                  size: 'lg',
                  className: 'h-14 w-full rounded-full px-8 text-lg sm:w-auto',
                })}
              >
                {t('hero.cta')}
                <ArrowRight aria-hidden="true" className="rotate-90" />
              </a>
              {/* Para quien prefiere mirar primero: el catálogo completo. */}
              <Link
                href="/stories"
                data-track="home_explore"
                className="border-b-2 border-foreground/25 px-1 pb-0.5 text-lg font-semibold transition-colors hover:border-primary hover:text-primary"
              >
                {t('hero.exploreStories')}
              </Link>
            </div>
            <HeroFacts />
          </div>
          <HeroBook alt={t('hero.bookAlt')} photoLabel={t('hero.photoLabel')} />
        </div>
      </section>

      <AudienceSelector />

      {/* Cómo funciona */}
      <section id={HOW_IT_WORKS_ID} className="container-page scroll-mt-28 py-20 lg:py-24">
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
                  <Icon className="size-11 text-primary/80" strokeWidth={1.5} aria-hidden="true" />
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
      </section>

      {/* Preguntas frecuentes */}
      {faqItems.length > 0 && (
        <section
          id={FAQ_ID}
          className="container-page grid scroll-mt-28 gap-10 py-20 lg:grid-cols-[1fr_1.6fr] lg:gap-16 lg:py-24"
        >
          <div>
            <h2 className="text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium">
              {t('faq.title')}
            </h2>
            <p className="mt-4 max-w-sm text-muted-foreground">
              {t.rich('faq.contact', {
                form: (chunks) => (
                  <a
                    href={`#${CONTACT_ID}`}
                    className="font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </div>
          <FaqGroups groups={faqGroups} />
        </section>
      )}

      {/* Garantía */}
      <section className="container-page">
        <div className="flex flex-col items-start gap-5 rounded-2xl border bg-card p-8 sm:flex-row sm:items-center sm:p-10">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-mint text-success">
            <ShieldCheck className="size-7" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-2xl font-medium">{t('guarantee.title')}</h2>
            <p className="mt-2 text-muted-foreground">{t('guarantee.text')}</p>
          </div>
        </div>
      </section>
      {/* Contacto: un formulario, sin el mail del equipo a la vista. */}
      <section
        id={CONTACT_ID}
        aria-labelledby="contact-title"
        className="container-page grid scroll-mt-28 gap-10 py-20 lg:grid-cols-[1fr_1.6fr] lg:gap-16 lg:py-24"
      >
        <div>
          <h2
            id="contact-title"
            className="text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium"
          >
            {tContact('title')}
          </h2>
          <p className="mt-4 max-w-sm text-muted-foreground">{tContact('text')}</p>
        </div>
        <ContactForm />
      </section>
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
      {faqItems.length > 0 && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqItems.map((item) => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: { '@type': 'Answer', text: item.answer },
            })),
          }}
        />
      )}
    </>
  );
}
