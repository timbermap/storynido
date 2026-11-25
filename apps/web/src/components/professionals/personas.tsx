import type { Locale, PublicStory } from '@storynido/shared';
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  HeartHandshake,
  MessageCircle,
  Puzzle,
  Smile,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { StoryCover } from '@/components/stories/story-cover';
import { Link } from '@/i18n/navigation';
import {
  PERSONA_KEYS,
  PERSONA_SLUGS,
  personaStories,
  type PersonaKey,
} from '@/lib/professional-personas';
import { cn } from '@/lib/utils';

export const PERSONA_ICONS: Record<PersonaKey, LucideIcon> = {
  teachers: GraduationCap,
  learning: BookOpen,
  psychology: HeartHandshake,
  speech: MessageCircle,
  occupational: Puzzle,
  pediatrics: Stethoscope,
  dentistry: Smile,
};

const personaHref = (locale: Locale, key: PersonaKey) => ({
  pathname: '/professionals/templates/[persona]' as const,
  params: { persona: PERSONA_SLUGS[locale][key] },
});

/**
 * «¿Cuál es tu trabajo?»: una tarjeta por tipo de profesional, con las tapas de sus primeras
 * historias. Cada una lleva a la página del perfil.
 */
export async function PersonaGrid({ locale, stories }: { locale: Locale; stories: PublicStory[] }) {
  const t = await getTranslations('Landing.professionals');
  return (
    <section className="container-page pt-10 pb-14 lg:pb-16">
      <h2 className="text-2xl leading-tight font-medium lg:text-3xl">{t('personasTitle')}</h2>
      <p className="mt-2 max-w-2xl text-lg text-muted-foreground">{t('personasSubtitle')}</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {PERSONA_KEYS.map((key) => {
          const Icon = PERSONA_ICONS[key];
          const own = personaStories(key, stories);
          return (
            <li key={key}>
              <Link
                href={personaHref(locale, key)}
                data-track="persona_opened"
                data-track-persona={key}
                className="group flex h-full flex-col rounded-xl border bg-card p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:hover:translate-y-0"
              >
                <span className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#eee8fa] text-[#5b4a99]">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="text-xl leading-snug font-semibold">
                    {t(`personas.${key}.name`)}
                  </span>
                </span>
                <span className="mt-3 text-muted-foreground">{t(`personas.${key}.short`)}</span>
                {own.length > 0 && (
                  <span aria-hidden="true" className="mt-4 flex gap-2">
                    {own.slice(0, 3).map((story) => (
                      <span
                        key={story.slug}
                        className="aspect-[3/4] w-1/3 overflow-hidden rounded-md shadow-[var(--shadow-card)]"
                      >
                        <StoryCover story={story} line="professionals" sizes="6rem" />
                      </span>
                    ))}
                  </span>
                )}
                <span className="mt-auto inline-flex items-center gap-2 pt-4 font-semibold text-primary group-hover:underline">
                  {t('personaCount', { count: own.length })}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Chips para pasar de un perfil a otro sin volver atrás. */
export async function PersonaChips({ locale, current }: { locale: Locale; current: PersonaKey }) {
  const t = await getTranslations('Landing.professionals');
  return (
    <nav aria-label={t('personaOther')} className="mt-8">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        {PERSONA_KEYS.map((key) => {
          const Icon = PERSONA_ICONS[key];
          const active = key === current;
          return (
            <li key={key} className="shrink-0">
              <Link
                href={personaHref(locale, key)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors',
                  active
                    ? 'border-transparent bg-[#eee8fa] text-[#5b4a99]'
                    : 'border-[rgb(38_50_74/0.12)] bg-card text-foreground/80 hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {t(`personas.${key}.name`)}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0">
          <Link
            href="/professionals/templates"
            className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap text-primary underline-offset-4 hover:underline"
          >
            {t('personaAll')}
          </Link>
        </li>
      </ul>
    </nav>
  );
}

/** Las historias del perfil, con la tapa grande y el título legible debajo. */
export async function PersonaStoryGrid({ stories }: { stories: PublicStory[] }) {
  const [t, tStories] = await Promise.all([
    getTranslations('Landing.professionals'),
    getTranslations('Stories'),
  ]);
  return (
    <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {stories.map((story, index) => {
        const title = story.titlePro ?? story.title;
        return (
          <li key={story.slug}>
            <Link
              href={{
                pathname: '/stories/[slug]',
                params: { slug: story.slug },
                query: { line: 'professionals' },
              }}
              data-track="story_opened"
              data-track-story={story.slug}
              aria-label={`${t('viewStory')}: ${title}`}
              className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <div className="aspect-[3/4] overflow-hidden rounded-xl bg-muted shadow-[var(--shadow-card)] transition group-hover:-translate-y-1 motion-reduce:group-hover:translate-y-0">
                <StoryCover
                  story={story}
                  line="professionals"
                  priority={index < 4}
                  sizes="(min-width: 1024px) 18rem, (min-width: 640px) 33vw, 50vw"
                />
              </div>
              <p className="mt-3 text-lg leading-snug font-semibold group-hover:underline">
                {title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {tStories('agesFor', { min: story.ageMin, max: story.ageMax })}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
