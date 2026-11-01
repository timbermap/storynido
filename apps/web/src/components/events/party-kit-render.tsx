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
    <figure className="relative mx-auto w-full max-w-xl" aria-label={t('alt', { name })}>
      <div className="relative aspect-[5/4]">
        {/* La invitación (a la izquierda, inclinada). */}
        <div
          aria-hidden="true"
          className="[container-type:inline-size] absolute top-[10%] left-0 w-[36%] -rotate-6 overflow-hidden rounded-xl bg-[#ffe4dc] shadow-[var(--shadow-card)]"
        >
          <div className="px-[6cqw] pt-[7cqw] pb-[3cqw] text-center font-display text-[#26324a]">
            <p className="text-[5cqw] font-bold tracking-[0.12em] uppercase">{t('invited')}</p>
            <p className="text-[13cqw] leading-tight font-bold uppercase">{name}</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- ilustración propia, servida tal cual */}
          <img
            src={story.coverImage}
            alt=""
            className="aspect-[25/24] w-full object-cover object-bottom"
          />
        </div>
        {/* El cuento: la portada como libro (al centro). */}
        <div className="absolute top-0 left-[30%] z-10 w-[40%] rotate-2">
          <div className="[container-type:inline-size] overflow-hidden rounded-[0.3rem_0.9rem_0.9rem_0.3rem] border-l-[8px] border-[#a98ac0] shadow-[var(--shadow-book)]">
            <div className="aspect-[3/4]">
              <StoryCover story={story} sizes="260px" priority />
            </div>
          </div>
        </div>
        {/* Las etiquetas con el nombre de cada invitado (a la derecha). Las medidas en cqw van en los
            hijos: en el mismo elemento que define el contenedor se calcularían contra la pantalla. */}
        <div aria-hidden="true" className="absolute right-0 bottom-[12%] flex w-[34%] gap-[4%]">
          {(['Sofía', 'Mateo'] as const).map((guest, index) => (
            <div
              key={guest}
              className="[container-type:inline-size] flex-1"
              style={{ transform: `rotate(${index === 0 ? -5 : 4}deg)` }}
            >
              <div className="rounded-md bg-[#fffdf8] px-[8cqw] pt-[22cqw] pb-[10cqw] text-center font-display text-[#26324a] shadow-[var(--shadow-card)]">
                <p className="text-[12cqw] font-semibold">{t('tagFor')}</p>
                <p className="text-[19cqw] font-bold">{guest}</p>
              </div>
            </div>
          ))}
        </div>
        {/* La guirnalda con el nombre del cumpleañero (abajo). */}
        <div
          aria-hidden="true"
          className="[container-type:inline-size] absolute right-[8%] bottom-0 left-[8%]"
        >
          <div className="flex justify-center gap-[1.5cqw]">
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
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted-foreground">
        {t('caption')}
      </figcaption>
    </figure>
  );
}
