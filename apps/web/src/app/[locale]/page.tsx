import { BookOpen, Eye, Gift, Globe, ShieldCheck, Sparkles, Truck, Upload } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { BookShowcase } from '@/components/home/book-showcase';
import { FaqList, parseFaq } from '@/components/home/faq-list';
import { JsonLd } from '@/components/json-ld';
import { FAQ_ID, HOW_IT_WORKS_ID } from '@/components/layout/site-header';
import { StoryCard } from '@/components/stories/story-card';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { brand } from '@/lib/brand';
import { lowestPrice } from '@/lib/offer';
import { getContent, getOffer, getStories } from '@/lib/server/api';
import { getDisplayCountry } from '@/lib/server/request-context';
import { SITE_URL, absoluteUrl } from '@/lib/site';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;

  const display = await getDisplayCountry(locale);
  const [t, tSwitch, stories, offer, faq] = await Promise.all([
    getTranslations('Home'),
    getTranslations('Switchers'),
    getStories(locale).catch(() => []),
    getOffer(display.country, locale),
    getContent('faq', locale).catch(() => null),
  ]);
  const fromPrice = lowestPrice(offer, locale, display.country);
  const faqItems = faq ? parseFaq(faq.body) : [];

  const steps = [
    { icon: Upload, title: t('how.step1Title'), text: t('how.step1Text') },
    { icon: Eye, title: t('how.step2Title'), text: t('how.step2Text') },
    { icon: BookOpen, title: t('how.step3Title'), text: t('how.step3Text') },
  ];

  const trust = [
    { icon: Sparkles, text: t('trust.preview') },
    {
      icon: Truck,
      text: t('trust.shipping', { country: tSwitch(`countries.${display.country}`) }),
    },
    { icon: ShieldCheck, text: t('trust.privacy') },
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
      <section className="relative overflow-hidden">
        <div className="container-page grid items-center gap-12 py-14 md:grid-cols-2 md:py-24">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
              <Sparkles className="size-4" aria-hidden="true" />
              {t('hero.eyebrow')}
            </p>
            <h1 className="text-4xl leading-[1.05] font-semibold sm:text-5xl lg:text-6xl">
              {t('hero.title')}
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">{t('hero.subtitle')}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/stories" className={buttonVariants({ size: 'lg' })}>
                {t('hero.cta')}
              </Link>
              <Link
                href={{ pathname: '/', hash: HOW_IT_WORKS_ID }}
                className={buttonVariants({ size: 'lg', variant: 'ghost' })}
              >
                {t('hero.secondary')}
              </Link>
            </div>
            {fromPrice && (
              <p className="text-sm font-medium text-muted-foreground">
                {t('hero.fromPrice', { price: fromPrice })}
              </p>
            )}
          </div>
          <BookShowcase
            covers={stories.map((story) => ({ src: story.coverImage, title: story.title }))}
          />
        </div>
      </section>

      {/* Confianza */}
      <section aria-label={t('trust.preview')} className="border-y bg-card">
        <ul className="container-page grid gap-4 py-6 text-sm font-medium sm:grid-cols-2 lg:grid-cols-4">
          {trust.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </section>

      {/* Cómo funciona */}
      <section id={HOW_IT_WORKS_ID} className="container-page scroll-mt-24 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold sm:text-4xl">{t('how.title')}</h2>
          <p className="mt-3 text-lg text-muted-foreground">{t('how.subtitle')}</p>
        </div>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="relative rounded-xl border bg-card p-6 shadow-sm">
              <span className="absolute -top-4 left-6 flex size-8 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <Icon className="mt-2 size-8 text-secondary" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Galería de historias */}
      {stories.length > 0 && (
        <section className="bg-muted/60 py-20">
          <div className="container-page">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-semibold sm:text-4xl">{t('gallery.title')}</h2>
                <p className="mt-2 text-lg text-muted-foreground">{t('gallery.subtitle')}</p>
              </div>
              <Link href="/stories" className={buttonVariants({ variant: 'outline' })}>
                {t('gallery.viewAll')}
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
              {stories.map((story) => (
                <StoryCard key={story.slug} story={story} fromPrice={fromPrice} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Preguntas frecuentes */}
      {faqItems.length > 0 && (
        <section id={FAQ_ID} className="container-page scroll-mt-24 py-20">
          <h2 className="text-center text-3xl font-semibold sm:text-4xl">{t('faq.title')}</h2>
          <div className="mx-auto mt-10 max-w-3xl">
            <FaqList items={faqItems} />
          </div>
        </section>
      )}

      {/* Garantía */}
      <section className="container-page">
        <div className="flex flex-col items-start gap-4 rounded-xl bg-secondary p-8 text-secondary-foreground sm:flex-row sm:items-center sm:p-10">
          <ShieldCheck className="size-12 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-2xl font-semibold">{t('guarantee.title')}</h2>
            <p className="mt-2 opacity-90">{t('guarantee.text')}</p>
          </div>
        </div>
      </section>

      {/* Llamado final */}
      <section className="container-page py-20 text-center">
        <Gift className="mx-auto size-10 text-primary" aria-hidden="true" />
        <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">{t('cta.title')}</h2>
        <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">{t('cta.text')}</p>
        <Link href="/stories" className={buttonVariants({ size: 'lg', className: 'mt-8' })}>
          {t('cta.button')}
        </Link>
      </section>
    </>
  );
}
