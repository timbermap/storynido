import { getTranslations } from 'next-intl/server';

import type { PublicStory } from '@storynido/shared';

import { StoryCover } from '@/components/stories/story-cover';

const FLAGS = ['#f7b5a4', '#f2d27a', '#a9d8c5', '#b7a6e8', '#9cc3ef', '#f4a6bd'];

/**
 * El kit armado en código con la ilustración real de una historia: la invitación, el cuento, la
 * guirnalda y las etiquetas con el nombre de cada invitado. Reemplaza las fotos generadas (que
 * traían una etiqueta «Name» en inglés y objetos que el kit no incluye).
 */
export async function PartyKitRender({ story }: { story: PublicStory }) {
  const t = await getTranslations('Landing.events.render');
  const name = story.castName ?? 'Alex';
  const letters = name.toLocaleUpperCase('es').split('').slice(0, 8);
  return (
    <figure className="relative mx-auto w-full max-w-lg" aria-label={t('alt', { name })}>
      <div className="relative aspect-square">
        {/* Una mancha de color que ancla la composición. */}
        <div
          aria-hidden="true"
          className="absolute inset-[6%_4%_4%] rounded-[46%_54%_52%_48%/52%_46%_54%_48%] bg-gradient-to-br from-[#ffe4dc] to-[#f3e8fb]"
        />
        {/* La guirnalda con el nombre del cumpleañero, apretada y colgando arriba. */}
        <div
          aria-hidden="true"
          className="[container-type:inline-size] absolute top-0 left-1/2 w-[64%] -translate-x-1/2"
        >
          <div className="flex justify-center gap-[1.4cqw]">
            {letters.map((letter, index) => (
              <span
                key={`${letter}-${String(index)}`}
                className="grid aspect-[3/4] w-[9cqw] place-items-start justify-center pt-[1.4cqw] font-display text-[5cqw] font-bold text-[#26324a]"
                style={{
                  background: FLAGS[index % FLAGS.length],
                  clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                }}
              >
                {letter}
              </span>
            ))}
          </div>
        </div>
        {/* La invitación asoma detrás del libro. */}
        <div
          aria-hidden="true"
          className="[container-type:inline-size] absolute top-[34%] left-[2%] w-[36%] -rotate-[7deg] overflow-hidden rounded-xl bg-[#ffe4dc] shadow-[var(--shadow-card)]"
        >
          <div className="px-[6cqw] pt-[7cqw] pb-[3cqw] text-center font-display text-[#26324a]">
            <p className="text-[5cqw] font-bold tracking-[0.12em] uppercase">{t('invited')}</p>
            <p className="text-[14cqw] leading-tight font-bold uppercase">{name}</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- ilustración propia, servida tal cual */}
          <img
            src={story.coverImage}
            alt=""
            className="aspect-[25/24] w-full object-cover object-bottom"
          />
        </div>
        {/* El cuento: la portada como libro, grande y al frente. */}
        <div className="absolute top-[14%] left-[30%] z-10 w-[56%] rotate-2">
          <div className="[container-type:inline-size] overflow-hidden rounded-[0.3rem_0.9rem_0.9rem_0.3rem] border-l-[9px] border-[#a98ac0] shadow-[var(--shadow-book)]">
            <div className="aspect-[3/4]">
              <StoryCover story={story} sizes="320px" priority />
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted-foreground">
        {t('caption')}
      </figcaption>
    </figure>
  );
}
