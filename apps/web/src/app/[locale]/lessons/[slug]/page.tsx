import { ArrowLeft, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import type { Locale } from '@storynido/shared';

import { StoryCard } from '@/components/stories/story-card';
import { buttonVariants } from '@/components/ui/button';
import { AuthLink } from '@/components/auth/auth-link';
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

  // Solo historias de Familias que sugieren esta enseñanza y cuya edad se cruza con la suya; la hecha
  // para ella va primero y destacada, y después las que la tienen en primer lugar de su lista.
  const overlaps = (story: (typeof stories)[number]) =>
    story.ageMin <= lesson.ageMax && story.ageMax >= lesson.ageMin;
  const ofFamilies = stories.filter((story) => story.channels[0] === 'families');
  const suggested = ofFamilies
    .filter((story) => story.suggestedLessons?.includes(lesson.slug) && overlaps(story))
    .toSorted((a, b) => {
      const rank = (story: (typeof stories)[number]) =>
        story.slug === lesson.featuredStory
          ? 0
          : story.suggestedLessons?.[0] === lesson.slug
            ? 1
            : 2;
      return rank(a) - rank(b);
    });
  // Si casi ninguna la sugiere, se completa con las compatibles por edad para no dejar la página vacía.
  const fallback =
    suggested.length >= 3
      ? []
      : ofFamilies.filter((story) => overlaps(story) && !suggested.includes(story)).slice(0, 4);
  const matching = [...suggested, ...fallback];
  const featured = lesson.featuredStory
    ? matching.find((story) => story.slug === lesson.featuredStory)
    : undefined;
  const chip = { slug: lesson.slug, name: lesson.name };
  const fromPrice = lowestPrice(offer, locale, display.country);

  return (
    <div className="container-page py-12">
      <Link
        href="/lessons"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('back')}
      </Link>

      <header className="mt-6 max-w-3xl">
        <p className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.11em] text-primary uppercase">
          <Sparkles className="size-4" aria-hidden="true" />
          {t(`groups.${lesson.group}`)} ·{' '}
          {tStories('agesFor', { min: lesson.ageMin, max: lesson.ageMax })}
        </p>
        <h1 className="mt-3 text-[clamp(2.3rem,4.5vw,3.8rem)] leading-[1.1] font-medium">
          {lesson.headline}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{lesson.description}</p>
        <AuthLink
          href={{
            pathname: '/create',
            query: { lesson: lesson.slug, line: 'families' },
          }}
          guest={t('ctaGuest')}
          member={t('cta')}
          className={buttonVariants({ size: 'lg', className: 'mt-6' })}
        />
      </header>

      <section className="mt-12" aria-labelledby="combine">
        <h2 id="combine" className="text-3xl font-medium">
          {featured ? t('madeForTitle') : t('combineTitle')}
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {featured ? t('madeForText', { story: featured.title }) : t('combineText')}
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {matching.map((story, index) => (
            <StoryCard
              key={story.slug}
              story={story}
              fromPrice={fromPrice}
              headingLevel="h3"
              priority={index < 2}
              compact
              lesson={chip}
            />
          ))}
        </div>
        <p className="mt-8 rounded-xl bg-secondary px-5 py-4 text-sm font-bold">{t('custom')}</p>
      </section>

      {/* Cierre antes del pie: la misma acción que arriba. */}
      <section className="mt-16 rounded-2xl bg-secondary px-6 py-12 text-center sm:px-12">
        <h2 className="text-[clamp(1.7rem,3vw,2.5rem)] leading-[1.1] font-medium">
          {t('finalTitle')}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{t('finalText')}</p>
        <AuthLink
          href={{
            pathname: '/create',
            query: { lesson: lesson.slug, line: 'families' },
          }}
          guest={t('ctaGuest')}
          member={t('ctaNow')}
          className={buttonVariants({ size: 'lg', className: 'mt-6' })}
        />
      </section>
    </div>
  );
}
