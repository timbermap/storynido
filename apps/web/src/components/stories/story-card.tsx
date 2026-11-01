import { getTranslations } from 'next-intl/server';

import type { PublicStory } from '@storynido/shared';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import { StoryCover } from './story-cover';

export async function StoryCard({
  story,
  fromPrice,
  headingLevel = 'h3',
  priority = false,
  compact = false,
  lineLabel,
  line,
  lesson,
}: {
  story: PublicStory;
  fromPrice: string | null;
  /** h2 en el catálogo (debajo del h1), h3 en la home (debajo de un h2). */
  headingLevel?: 'h2' | 'h3';
  /** Las primeras tarjetas visibles se cargan de inmediato. */
  priority?: boolean;
  /** Más chica y sin protagonismo (por ejemplo, las aventuras de una enseñanza). */
  compact?: boolean;
  /** En el buscador general: de qué línea es la historia (Familias, Celebraciones, Profesionales). */
  lineLabel?: string;
  /** Línea desde la que se mira la historia (Profesionales usa su propia portada si la tiene). */
  line?: string | null;
  /** Enseñanza con la que se llegó: viaja en el link y se ve en la tarjeta («Con: …»). */
  lesson?: { slug: string; name: string };
}) {
  const t = await getTranslations('Stories');
  const Heading = headingLevel;
  return (
    <Link
      href={{
        pathname: '/stories/[slug]',
        params: { slug: story.slug },
        ...(lesson ? { query: { lesson: lesson.slug } } : {}),
      }}
      data-track="story_opened"
      data-track-story={story.slug}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)] transition duration-200 hover:-translate-y-1 motion-reduce:hover:translate-y-0"
    >
      <div className="aspect-[3/4] overflow-hidden bg-muted">
        {/* Imagen propia y liviana: se sirve tal cual (sin optimizador de imágenes). */}
        <StoryCover
          story={story}
          line={line}
          priority={priority}
          sizes={compact ? '(min-width: 1024px) 20vw, 33vw' : '(min-width: 1024px) 33vw, 50vw'}
          className="transition duration-500 group-hover:scale-105"
        />
      </div>
      <div
        className={compact ? 'flex flex-1 flex-col gap-1.5 p-3' : 'flex flex-1 flex-col gap-2 p-4'}
      >
        <Heading
          className={cn(
            compact ? 'text-base leading-snug font-semibold' : 'text-xl leading-snug font-semibold',
            // La portada ya lleva el título: acá queda solo para lectores de pantalla.
            story.coverTitleOverlay && 'sr-only',
          )}
        >
          {story.title}
        </Heading>
        <p className="flex flex-wrap items-center gap-1.5">
          {lineLabel && (
            <span className="w-fit rounded-full bg-peach px-2.5 py-0.5 text-xs font-semibold text-[#a33f33]">
              {lineLabel}
            </span>
          )}
          <span className="w-fit rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-primary">
            {t('agesFor', { min: story.ageMin, max: story.ageMax })}
          </span>
        </p>
        {lesson && (
          <p className="w-fit rounded-full bg-mint px-2.5 py-0.5 text-xs font-semibold text-success">
            {t('withLesson', { name: lesson.name })}
          </p>
        )}
        {fromPrice && (
          <p className="mt-auto text-sm font-bold text-primary">
            {t('from', { price: fromPrice })}
          </p>
        )}
      </div>
    </Link>
  );
}
