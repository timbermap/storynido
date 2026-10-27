import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

import type { PublicStory } from '@storynido/shared';

import { Link } from '@/i18n/navigation';

export async function StoryCard({
  story,
  fromPrice,
  headingLevel = 'h3',
  priority = false,
}: {
  story: PublicStory;
  fromPrice: string | null;
  /** h2 en el catálogo (debajo del h1), h3 en la home (debajo de un h2). */
  headingLevel?: 'h2' | 'h3';
  /** Las primeras tarjetas visibles se cargan de inmediato. */
  priority?: boolean;
}) {
  const t = await getTranslations('Stories');
  const Heading = headingLevel;
  return (
    <Link
      href={{ pathname: '/stories/[slug]', params: { slug: story.slug } }}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)] transition duration-200 hover:-translate-y-1 motion-reduce:hover:translate-y-0"
    >
      <div className="aspect-[3/4] overflow-hidden bg-muted">
        {/* SVG propio y liviano: se sirve tal cual (sin optimizador de imágenes). */}
        <Image
          src={story.coverImage}
          alt=""
          width={600}
          height={800}
          unoptimized
          priority={priority}
          sizes="(min-width: 1024px) 33vw, 50vw"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Heading className="text-xl leading-snug font-semibold">{story.title}</Heading>
        <p className="w-fit rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-primary">
          {t('agesFor', { min: story.ageMin, max: story.ageMax })}
        </p>
        {fromPrice && (
          <p className="mt-auto text-sm font-bold text-primary">
            {t('from', { price: fromPrice })}
          </p>
        )}
      </div>
    </Link>
  );
}
