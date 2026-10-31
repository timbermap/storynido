import { Check } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { ImageSlot } from '@/components/landing/image-slot';
import { CoverTitle } from '@/components/stories/story-cover';

/** Muestra la transformación foto → personaje sin usar fotos reales de menores. */
export async function PhotoToStory() {
  const t = await getTranslations('Home.photo');
  return (
    <section className="container-page py-20 lg:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <h2 className="text-[clamp(1.9rem,3.3vw,2.85rem)] leading-[1.1] font-medium">
            {t('title')}
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">{t('subtitle')}</p>
          <ul className="mt-6 grid gap-3">
            {(['point1', 'point2', 'point3'] as const).map((point) => (
              <li key={point} className="flex items-start gap-3 font-semibold">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-mint text-success">
                  <Check className="size-4" aria-hidden="true" />
                </span>
                {t(point)}
              </li>
            ))}
          </ul>
        </div>

        <figure className="relative mx-auto w-full max-w-xl">
          {/* Su personaje ilustrado: el mismo chico de la foto, en el estilo de la casa. */}
          <div className="ml-auto aspect-square w-[82%] overflow-hidden rounded-[2rem] bg-[linear-gradient(145deg,#fffaf5,#eee8fa)] shadow-[0_17px_45px_rgb(80_52_84/0.08)]">
            <ImageSlot
              src="/images/secciones/personaje.webp"
              alt=""
              width={900}
              height={900}
              sizes="(min-width: 1024px) 460px, 80vw"
              tone="bg-[#fff7f2]"
            />
          </div>
          <span className="absolute -top-3 right-4 rounded-full bg-card px-3 py-1 text-xs font-semibold text-primary shadow-[var(--shadow-card)]">
            {t('characterLabel')}
          </span>

          {/* La foto de la familia (de muestra), con el marco de una polaroid. */}
          <div className="absolute -bottom-8 -left-2 w-32 -rotate-6 rounded-md bg-card p-2 pb-6 shadow-[var(--shadow-book)] sm:-left-8 sm:w-40">
            <div className="overflow-hidden rounded-sm">
              <ImageSlot
                src="/images/secciones/foto-real.webp"
                alt=""
                width={900}
                height={900}
                sizes="160px"
                tone="bg-sky"
              />
            </div>
            <span className="mt-2 block text-center text-xs font-semibold text-muted-foreground">
              {t('photoLabel')}
            </span>
          </div>
          {/* La portada que sale de las dos cosas, con su título en tipografía real. */}
          <div className="absolute -right-2 -bottom-10 w-24 rotate-3 overflow-hidden rounded-md shadow-[var(--shadow-book)] sm:-right-6 sm:w-32">
            <div className="[container-type:inline-size] relative aspect-[3/4]">
              <ImageSlot
                src="/samples/aventura-espacial.webp"
                alt=""
                width={1200}
                height={1600}
                sizes="128px"
                tone="bg-[#26324a]"
              />
              <CoverTitle before={t('coverLine1')} name={t('coverName')} ink="light" />
            </div>
          </div>
          <figcaption className="mt-12 text-right text-xs text-muted-foreground">
            {t('sample')}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
