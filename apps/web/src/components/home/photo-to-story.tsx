import { Camera, Check } from 'lucide-react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

import heroWatercolor from '../../../public/brand/hero-acuarela.webp';

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
          {/* Primer plano del personaje (recorte de la ilustración del hero). */}
          <div className="ml-auto aspect-square w-[82%] overflow-hidden rounded-[2rem] bg-[linear-gradient(145deg,#fff9f3,#efe4f6)] shadow-[0_17px_45px_rgb(80_52_84/0.08)]">
            <Image
              src={heroWatercolor}
              alt=""
              sizes="(min-width: 1024px) 460px, 80vw"
              placeholder="blur"
              className="h-full w-full scale-[1.9] object-cover object-[46%_38%]"
            />
          </div>
          <span className="absolute -top-3 right-4 rounded-full bg-card px-3 py-1 text-xs font-semibold text-primary shadow-[var(--shadow-card)]">
            {t('characterLabel')}
          </span>

          {/* Marco tipo polaroid: representa la foto que sube la familia (no es una foto real). */}
          <div className="absolute -bottom-8 -left-2 w-32 -rotate-6 rounded-md bg-card p-2 pb-6 shadow-[var(--shadow-book)] sm:-left-8 sm:w-40">
            <div className="grid aspect-square place-items-center rounded-sm border-2 border-dashed border-primary/40 bg-sky text-primary">
              <Camera className="size-9" aria-hidden="true" />
            </div>
            <span className="mt-2 block text-center text-xs font-semibold text-muted-foreground">
              {t('photoLabel')}
            </span>
          </div>
          <svg
            aria-hidden="true"
            viewBox="0 0 120 80"
            className="absolute bottom-10 left-28 w-20 text-primary sm:left-36 sm:w-24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <path d="M6 70 C 30 70, 50 20, 104 18" />
            <path d="M92 8 L106 18 L94 30" />
          </svg>
          <figcaption className="mt-12 text-right text-xs text-muted-foreground">
            {t('sample')}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
