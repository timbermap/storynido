import { ArrowLeft, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import type { Locale } from '@storynido/shared';

import { HOW_IT_WORKS_ID } from '@/components/layout/site-header';
import { StoryCard } from '@/components/stories/story-card';
import { Link } from '@/i18n/navigation';
import { lowestPrice } from '@/lib/offer';
import { localizedAlternates } from '@/lib/seo';
import { getLesson, getOffer, getStories } from '@/lib/server/api';
import { getDisplayCountry } from '@/lib/server/request-context';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const lesson = await getLesson(locale as Locale, slug).catch(() => null);
  if (!lesson) return {};
  return {
    title: lesson.headline,
    description: lesson.description,
    alternates: localizedAlternates(locale as Locale, () => ({
      pathname: '/lessons/[slug]',
      params: { slug },
    })),
  };
}

/** Página de una enseñanza: qué transmite y con qué aventuras se combina. */
export default async function LessonPage({ params }: Props) {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale as Locale;
  const display = await getDisplayCountry(locale);
  const [lesson, stories, offer, t, tStories] = await Promise.all([
    getLesson(locale, slug),
    getStories(locale),
    getOffer(display.country, locale),
    getTranslations('Lessons'),
    getTranslations('Stories'),
  ]);
  if (!lesson) notFound();

  // Aventuras cuya edad se superpone con la de la enseñanza.
  const matching = stories.filter(
    (story) => story.ageMin <= lesson.ageMax && story.ageMax >= lesson.ageMin,
  );
  const fromPrice = lowestPrice(offer, locale, display.country);

  return (
    <div className="container-page py-12">
      <Link
        href={{ pathname: '/', hash: HOW_IT_WORKS_ID }}
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('back')}
      </Link>

      <header className="mt-6 max-w-3xl">
        <p className="inline-flex items-center gap-2 text-xs font-black tracking-[0.11em] text-primary uppercase">
          <Sparkles className="size-4" aria-hidden="true" />
          {t(`groups.${lesson.group}`)} ·{' '}
          {tStories('agesFor', { min: lesson.ageMin, max: lesson.ageMax })}
        </p>
        <h1 className="mt-3 text-[clamp(2.3rem,4.5vw,3.8rem)] leading-[1.1] font-semibold">
          {lesson.headline}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{lesson.description}</p>
      </header>

      <section className="mt-12" aria-labelledby="combine">
        <h2 id="combine" className="text-3xl font-semibold">
          {t('combineTitle')}
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t('combineText')}</p>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
          {matching.map((story, index) => (
            <StoryCard
              key={story.slug}
              story={story}
              fromPrice={fromPrice}
              headingLevel="h3"
              priority={index < 2}
            />
          ))}
        </div>
        <p className="mt-8 rounded-xl bg-secondary px-5 py-4 text-sm font-bold">{t('custom')}</p>
      </section>
    </div>
  );
}
