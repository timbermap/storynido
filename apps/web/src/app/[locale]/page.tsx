import {
  ArrowRight,
  BookOpen,
  Gift,
  Globe,
  Map,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRound,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { HeroBook } from '@/components/home/hero-book';
import { NameCoverDemo } from '@/components/home/name-cover-demo';
import { PhotoToStory } from '@/components/home/photo-to-story';
import { FaqList, parseFaq } from '@/components/home/faq-list';
import { AudienceSelector } from '@/components/landing/audience-selector';
import { JsonLd } from '@/components/json-ld';
import { LessonGroups } from '@/components/lessons/lesson-groups';
import { FAQ_ID, HOW_IT_WORKS_ID } from '@/components/layout/site-header';
import { StoryCard } from '@/components/stories/story-card';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { brand } from '@/lib/brand';
import { lowestPrice, offerHighlights } from '@/lib/offer';
import { getContent, getLessons, getOffer, getStories } from '@/lib/server/api';
import { getDisplayCountry } from '@/lib/server/request-context';
import { SITE_URL, absoluteUrl } from '@/lib/site';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;

  const display = await getDisplayCountry(locale);
  const [t, tLessons, stories, lessons, offer, faq] = await Promise.all([
    getTranslations('Home'),
    getTranslations('Lessons'),
    getStories(locale).catch(() => []),
    getLessons(locale).catch(() => []),
    getOffer(display.country, locale),
    getContent('faq', locale).catch(() => null),
  ]);
  const fromPrice = lowestPrice(offer, locale, display.country);
  const highlights = offerHighlights(offer, locale, display.country);
  const faqItems = faq ? parseFaq(faq.body) : [];

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
      tone: 'bg-peach text-[#8a4a2a]',
    },
    {
      icon: BookOpen,
      title: t('how.step3Title'),
      text: t('how.step3Text'),
      tone: 'bg-mint text-success',
    },
  ];

  const trust = [
    { icon: Globe, text: t('trustInline.formats') },
    { icon: Truck, text: t('trustInline.shipping') },
    { icon: Sparkles, text: t('trustInline.preview') },
  ];

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: brand.name,
          url: SITE_URL,
          logo: absoluteUrl('/icon.svg'),
          email: 'hola@storynido.com',
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

      {/* Hero */}
      <section className="overflow-hidden">
        <div className="container-page grid items-center gap-6 pt-8 pb-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-10 lg:pt-14 lg:pb-16">
          <div className="text-center lg:text-left">
            <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              {t('hero.kicker')}
            </p>
            <h1 className="mt-5 text-[clamp(2.7rem,5.2vw,5.1rem)] leading-[1.02] font-medium tracking-[-0.025em] lg:whitespace-nowrap">
              {t.rich('hero.headline', {
                br: () => <br />,
                hl: (chunks) => <span className="text-primary">{chunks}</span>,
              })}
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-[clamp(1.1rem,1.6vw,1.3rem)] leading-relaxed text-muted-foreground lg:mx-0">
              {t('hero.lead')}
            </p>
            <div className="mt-9 flex flex-col items-center gap-5 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href="/create"
                className={buttonVariants({
                  size: 'lg',
                  className: 'h-14 w-full rounded-full px-8 text-lg sm:w-auto',
                })}
              >
                {t('hero.cta')}
                <ArrowRight aria-hidden="true" />
              </Link>
              <Link
                href="/stories"
                className="border-b-2 border-foreground/25 pb-0.5 text-lg font-semibold transition-colors hover:border-primary hover:text-primary"
              >
                {t('hero.explore')}
              </Link>
            </div>
            {highlights && (
              <p className="mt-4 text-sm text-muted-foreground">
                {highlights.digital && (
                  <span className="font-bold text-foreground">
                    {t('hero.priceDigital', { price: highlights.digital })}
                  </span>
                )}
                {highlights.digital && highlights.printed && ' · '}
                {highlights.printed && (
                  <span className="font-bold text-foreground">
                    {t('hero.pricePrinted', { price: highlights.printed })}
                  </span>
                )}
                <span className="block text-xs">{t('hero.priceUsd')}</span>
              </p>
            )}
            <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-semibold text-muted-foreground lg:justify-start">
              {trust.map(({ icon: Icon, text }) => (
                <li key={text} className="inline-flex items-center gap-2">
                  <Icon
                    className="size-[1.15rem] text-foreground/60"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  {text}
                </li>
              ))}
            </ul>
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
                  className="absolute top-12 -right-5 hidden size-7 text-[#d8b9a8] md:block"
                  strokeWidth={1.5}
                />
              )}
              <h3 className="mt-6 text-2xl leading-tight font-medium">{title}</h3>
              <p className="mt-2 max-w-xs text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <PhotoToStory />

      <NameCoverDemo
        labels={{
          title: t('cover.title'),
          subtitle: t('cover.subtitle'),
          label: t('cover.label'),
          defaultName: t('cover.defaultName'),
          line1: t('cover.line1'),
          line3: t('cover.line3'),
          sample: t('cover.sample'),
          cta: t('cover.cta'),
        }}
      />

      {/* Galería de historias */}
      {stories.length > 0 && (
        <section className="bg-muted py-20 lg:py-24">
          <div className="container-page">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <h2 className="text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium">
                  {t('gallery.title')}
                </h2>
                <p className="mt-3 text-lg text-muted-foreground">{t('gallery.subtitle')}</p>
              </div>
              <Link href="/stories" className={buttonVariants({ variant: 'outline' })}>
                {t('gallery.viewAll')}
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
              {/* Hasta 6 en la home (dos filas completas); el resto, en el catálogo. */}
              {stories.slice(0, 6).map((story) => (
                <StoryCard key={story.slug} story={story} fromPrice={fromPrice} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Enseñanzas */}
      {lessons.length > 0 && (
        <section className="container-page py-20 lg:py-24">
          <div className="max-w-2xl">
            <h2 className="text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium">
              {tLessons('title')}
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">{tLessons('subtitle')}</p>
          </div>
          <div className="mt-10">
            <LessonGroups lessons={lessons} />
          </div>
        </section>
      )}

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
                mail: (chunks) => (
                  <a
                    href="mailto:hola@storynido.com"
                    className="font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </div>
          <FaqList items={faqItems} />
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

      {/* Llamado final */}
      <section className="container-page py-20">
        <div className="relative overflow-hidden rounded-2xl bg-secondary px-6 py-14 text-center sm:px-12">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-10 right-[8%] text-[13rem] leading-none text-primary/10"
          >
            ✦
          </span>
          <Gift className="relative mx-auto size-10 text-primary" aria-hidden="true" />
          <h2 className="relative mt-4 text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium">
            {t('cta.title')}
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-lg text-muted-foreground">
            {t('cta.text')}
          </p>
          <Link
            href="/create"
            className={buttonVariants({ size: 'lg', className: 'relative mt-8' })}
          >
            {t('cta.button')}
          </Link>
        </div>
      </section>
    </>
  );
}
