import {
  ArrowRight,
  BookOpen,
  Gift,
  Globe,
  Lock,
  Map,
  Sparkles,
  Truck,
  UserRound,
  ShieldCheck,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { HeroArt } from '@/components/home/hero-art';
import { FaqList, parseFaq } from '@/components/home/faq-list';
import { JsonLd } from '@/components/json-ld';
import { LessonGroups } from '@/components/lessons/lesson-groups';
import { FAQ_ID, HOW_IT_WORKS_ID } from '@/components/layout/site-header';
import { StoryCard } from '@/components/stories/story-card';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { brand } from '@/lib/brand';
import { lowestPrice } from '@/lib/offer';
import { getContent, getLessons, getOffer, getStories } from '@/lib/server/api';
import { getDisplayCountry } from '@/lib/server/request-context';
import { SITE_URL, absoluteUrl } from '@/lib/site';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;

  const display = await getDisplayCountry(locale);
  const [t, tSwitch, tLessons, stories, lessons, offer, faq] = await Promise.all([
    getTranslations('Home'),
    getTranslations('Switchers'),
    getTranslations('Lessons'),
    getStories(locale).catch(() => []),
    getLessons(locale).catch(() => []),
    getOffer(display.country, locale),
    getContent('faq', locale).catch(() => null),
  ]);
  const fromPrice = lowestPrice(offer, locale, display.country);
  const faqItems = faq ? parseFaq(faq.body) : [];

  const steps = [
    { icon: UserRound, title: t('how.step1Title'), text: t('how.step1Text') },
    { icon: Map, title: t('how.step2Title'), text: t('how.step2Text') },
    { icon: BookOpen, title: t('how.step3Title'), text: t('how.step3Text') },
  ];

  const trust = [
    { icon: Sparkles, text: t('trust.preview') },
    {
      icon: Truck,
      text: t('trust.shipping', { country: tSwitch(`countries.${display.country}`) }),
    },
    { icon: Lock, text: t('trust.privacy') },
    { icon: Globe, text: t('trust.languages') },
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
        <div className="container-page grid items-center gap-8 pt-10 pb-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14 lg:pt-16 lg:pb-24">
          <div className="text-center lg:text-left">
            <p className="inline-flex items-center gap-2 text-xs font-black tracking-[0.11em] text-primary uppercase">
              <span aria-hidden="true" className="size-2 rounded-full bg-star" />
              {t('hero.eyebrow')}
            </p>
            <h1 className="mt-4 text-[clamp(2.65rem,5.1vw,5rem)] leading-[1.08] font-semibold">
              {t('hero.title')}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[clamp(1.1rem,1.65vw,1.3rem)] leading-relaxed text-muted-foreground lg:mx-0">
              {t('hero.subtitle')}
            </p>
            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start">
              <Link href="/create" className={buttonVariants({ size: 'lg' })}>
                {t('hero.cta')}
                <ArrowRight aria-hidden="true" />
              </Link>
              <Link
                href={{ pathname: '/', hash: HOW_IT_WORKS_ID }}
                className={buttonVariants({ size: 'lg', variant: 'ghost' })}
              >
                {t('hero.secondary')}
              </Link>
            </div>
            <p className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm font-bold text-muted-foreground lg:justify-start">
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="size-4 text-primary" aria-hidden="true" />
                {t('hero.formats')}
              </span>
              {fromPrice && <span>{t('hero.fromPrice', { price: fromPrice })}</span>}
            </p>
          </div>
          <HeroArt alt={t('hero.imageAlt')} />
        </div>
      </section>

      {/* Confianza */}
      <section aria-label={t('trust.preview')} className="border-y bg-card">
        <ul className="container-page grid gap-4 py-5 text-sm font-extrabold sm:grid-cols-2 lg:grid-cols-4">
          {trust.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mint text-success">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </section>

      {/* Cómo funciona */}
      <section id={HOW_IT_WORKS_ID} className="container-page scroll-mt-28 py-20 lg:py-24">
        <div className="max-w-2xl">
          <h2 className="text-[clamp(2rem,4vw,3.5rem)] leading-[1.1] font-semibold">
            {t('how.title')}
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">{t('how.subtitle')}</p>
        </div>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="rounded-xl border bg-card p-7 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-[0.95rem] bg-secondary text-lg font-black text-primary">
                  {index + 1}
                </span>
                <Icon className="size-7 text-primary/70" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-2xl leading-tight font-semibold">{title}</h3>
              <p className="mt-2 text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Galería de historias */}
      {stories.length > 0 && (
        <section className="bg-muted py-20 lg:py-24">
          <div className="container-page">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <h2 className="text-[clamp(2rem,4vw,3.5rem)] leading-[1.1] font-semibold">
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
            <h2 className="text-[clamp(2rem,4vw,3.5rem)] leading-[1.1] font-semibold">
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
        <section id={FAQ_ID} className="container-page scroll-mt-28 py-20 lg:py-24">
          <h2 className="text-center text-[clamp(2rem,4vw,3.5rem)] leading-[1.1] font-semibold">
            {t('faq.title')}
          </h2>
          <div className="mx-auto mt-10 max-w-3xl">
            <FaqList items={faqItems} />
          </div>
        </section>
      )}

      {/* Garantía */}
      <section className="container-page">
        <div className="flex flex-col items-start gap-5 rounded-xl border bg-card p-8 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:p-10">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-mint text-success">
            <ShieldCheck className="size-7" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-2xl font-semibold">{t('guarantee.title')}</h2>
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
          <h2 className="relative mt-4 text-[clamp(2rem,4vw,3.2rem)] leading-[1.1] font-semibold">
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
