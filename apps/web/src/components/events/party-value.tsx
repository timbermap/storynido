import { ArrowRight, Check } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { ImageSlot } from '@/components/landing/image-slot';

/**
 * El valor agregado de Celebraciones, explicado antes de los productos: de su foto a su personaje
 * y de ahí a todas las piezas de la fiesta. Imágenes de muestra, nunca fotos de menores.
 */
export async function PartyValue({ coverImage }: { coverImage?: string }) {
  const t = await getTranslations('Landing.events.value');
  const steps = [
    { kind: 'image', src: '/images/secciones/foto-real.webp', label: t('photoLabel') },
    { kind: 'image', src: '/images/secciones/personaje.webp', label: t('characterLabel') },
    ...(coverImage ? [{ kind: 'image', src: coverImage, label: t('kitLabel') } as const] : []),
  ] as const;
  return (
    <section className="container-page py-16 lg:py-20">
      <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
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
        <figure>
          <ol className="grid grid-cols-3 items-start gap-4 sm:gap-6">
            {steps.map((step, index) => (
              <li key={step.label} className="relative grid gap-2">
                <div className="aspect-square overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)]">
                  <ImageSlot
                    src={step.src}
                    alt=""
                    width={900}
                    height={900}
                    sizes="(min-width: 1024px) 190px, 30vw"
                    tone="bg-[#fff7f2]"
                    className="h-full object-cover object-bottom"
                  />
                </div>
                <span className="text-center text-xs font-bold sm:text-sm">{step.label}</span>
                {index < steps.length - 1 && (
                  <ArrowRight
                    aria-hidden="true"
                    className="absolute top-1/3 -right-3.5 size-5 text-primary sm:-right-5"
                  />
                )}
              </li>
            ))}
          </ol>
          <figcaption className="mt-4 text-center text-xs text-muted-foreground">
            {t('sample')}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
