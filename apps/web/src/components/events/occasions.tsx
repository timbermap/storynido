import type { EventType, Locale, PublicStory } from '@storynido/shared';
import {
  ArrowRight,
  Bird,
  Cake,
  Camera,
  Droplets,
  Eye,
  GraduationCap,
  PartyPopper,
  Shapes,
  type LucideIcon,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { StoryCover } from '@/components/stories/story-cover';
import { Link } from '@/i18n/navigation';
import {
  OCCASION_KEYS,
  OCCASION_SLUGS,
  occasionCollections,
  occasionStories,
  type OccasionKey,
} from '@/lib/event-occasions';
import { cn } from '@/lib/utils';

export const OCCASION_ICONS: Record<OccasionKey, LucideIcon> = {
  birthday: PartyPopper,
  graduation: GraduationCap,
  firstBirthday: Cake,
  baptism: Droplets,
  communion: Bird,
};

/** Insignia y círculo del ícono: coral suave con texto navy (contraste AA, docs/BRAND.md). */
export const OCCASION_BADGE = 'bg-coral-soft text-navy';

const occasionHref = (locale: Locale, key: OccasionKey) => ({
  pathname: '/events/themes/[occasion]' as const,
  params: { occasion: OCCASION_SLUGS[locale][key] },
});

interface OccasionCollection {
  slug: string;
  eventType?: EventType | null;
}

/**
 * «¿Qué celebrás?»: una tarjeta por ocasión, con las tapas de sus primeros cuentos. Cada una lleva
 * a la página de la ocasión.
 */
export async function OccasionGrid({
  locale,
  collections,
  stories,
  id,
  landing = false,
}: {
  locale: Locale;
  collections: OccasionCollection[];
  stories: PublicStory[];
  /** Ancla para llegar desde un botón del hero. */
  id?: string;
  /** En la landing de la línea: más aire arriba y un enlace a todas las temáticas al pie. */
  landing?: boolean;
}) {
  const t = await getTranslations('Landing.events');
  const cards = OCCASION_KEYS.map((key) => {
    const themes = occasionCollections(key, collections);
    return {
      key,
      themes,
      own: occasionStories(
        themes.map((theme) => theme.slug),
        stories,
      ),
    };
  }).filter((card) => card.themes.length > 0);
  if (cards.length === 0) return null;
  return (
    <section
      id={id}
      className={cn(
        'container-page scroll-mt-28 pb-14 lg:pb-16',
        landing ? 'pt-20 lg:pt-24' : 'pt-10',
      )}
    >
      <h2 className="text-2xl leading-tight font-medium lg:text-3xl">{t('occasionsTitle')}</h2>
      <p className="mt-2 max-w-2xl text-lg text-muted-foreground">{t('occasionsSubtitle')}</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ key, themes, own }) => {
          const Icon = OCCASION_ICONS[key];
          return (
            <li key={key}>
              <Link
                href={occasionHref(locale, key)}
                data-track="occasion_opened"
                data-track-occasion={key}
                className="group flex h-full flex-col rounded-xl border bg-card p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:hover:translate-y-0"
              >
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      'grid size-11 shrink-0 place-items-center rounded-full',
                      OCCASION_BADGE,
                    )}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="text-xl leading-snug font-semibold">
                    {t(`occasions.${key}.name`)}
                  </span>
                </span>
                <span className="mt-3 text-muted-foreground">{t(`occasions.${key}.short`)}</span>
                {own.length > 0 && (
                  <span aria-hidden="true" className="mt-4 flex gap-2">
                    {own.slice(0, 3).map((story) => (
                      <span
                        key={story.slug}
                        className="aspect-[3/4] w-1/3 overflow-hidden rounded-md shadow-[var(--shadow-card)]"
                      >
                        <StoryCover story={story} line="events" sizes="6rem" />
                      </span>
                    ))}
                  </span>
                )}
                <span className="mt-auto inline-flex items-center gap-2 pt-4 font-semibold text-primary group-hover:underline">
                  {themes.length > 1
                    ? t('occasionThemesCount', { count: themes.length })
                    : t('occasionStoriesCount', { count: own.length })}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {landing && (
        <Link
          href="/events/themes"
          className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-primary underline-offset-4 hover:underline"
        >
          {t('occasionAll')}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

/** Chips para pasar de una ocasión a otra sin volver atrás. */
export async function OccasionChips({
  locale,
  current,
  available,
}: {
  locale: Locale;
  current: OccasionKey;
  /** Solo las ocasiones con temáticas activas (sin catálogo, todas). */
  available?: OccasionKey[];
}) {
  const t = await getTranslations('Landing.events');
  const keys = available && available.length > 0 ? available : OCCASION_KEYS;
  return (
    <nav aria-label={t('occasionOther')} className="mt-8">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        {keys.map((key) => {
          const Icon = OCCASION_ICONS[key];
          const active = key === current;
          return (
            <li key={key} className="shrink-0">
              <Link
                href={occasionHref(locale, key)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors',
                  active
                    ? cn('border-transparent', OCCASION_BADGE)
                    : 'border-[rgb(38_50_74/0.12)] bg-card text-foreground/80 hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {t(`occasions.${key}.name`)}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0">
          <Link
            href="/events/themes"
            className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap text-primary underline-offset-4 hover:underline"
          >
            {t('occasionAll')}
          </Link>
        </li>
      </ul>
    </nav>
  );
}

const MADE_ICONS: Record<'1' | '2' | '3', LucideIcon> = { '1': Camera, '2': Shapes, '3': Eye };

/**
 * Que se entienda que el cuento se hace a medida (Sebas, 25 nov): el chico es el protagonista,
 * a partir de una foto o de rasgos elegidos, y se ve la muestra antes de pagar.
 */
export async function MadeToMeasure({ className }: { className?: string }) {
  const t = await getTranslations('Landing.events');
  return (
    <div className={cn('rounded-xl bg-coral-soft p-5 sm:p-6', className)}>
      <h2 className="text-lg font-semibold text-navy">{t('madeTitle')}</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {(['1', '2', '3'] as const).map((n) => {
          const Icon = MADE_ICONS[n];
          return (
            <li key={n} className="flex gap-3 text-navy/90">
              <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <span>{t(`made.${n}`)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Los cuentos de la ocasión, con la tapa grande y el título legible debajo. */
export async function OccasionStoryGrid({ stories }: { stories: PublicStory[] }) {
  const [t, tStories] = await Promise.all([
    getTranslations('Landing.events'),
    getTranslations('Stories'),
  ]);
  return (
    <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {stories.map((story, index) => (
        <li key={story.slug}>
          <Link
            href={{
              pathname: '/stories/[slug]',
              params: { slug: story.slug },
              query: { line: 'events' },
            }}
            data-track="story_opened"
            data-track-story={story.slug}
            aria-label={`${t('viewStory')}: ${story.title}`}
            className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <div className="aspect-[3/4] overflow-hidden rounded-xl bg-muted shadow-[var(--shadow-card)] transition group-hover:-translate-y-1 motion-reduce:group-hover:translate-y-0">
              <StoryCover
                story={story}
                line="events"
                priority={index < 4}
                sizes="(min-width: 1024px) 18rem, (min-width: 640px) 33vw, 50vw"
              />
            </div>
            <p className="mt-3 text-lg leading-snug font-semibold group-hover:underline">
              {story.title}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tStories('agesFor', { min: story.ageMin, max: story.ageMax })}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
