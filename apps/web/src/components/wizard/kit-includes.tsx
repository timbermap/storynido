'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';

import type { KitOffer } from '@storynido/shared';

import { IllustrativeCaption } from '@/components/formats/format-showcase';

/** Lo que trae el kit completo, en un solo lugar: «¿Qué llevas?» y la muestra dicen lo mismo. */
export const KIT_INCLUDES = ['invitation', 'decoration', 'keepsake', 'activities'] as const;

type KitPiece = (typeof KIT_INCLUDES)[number];

/** Una imagen por pieza, hecha con lo que entregó un kit real de staging (DECISIONS 247). */
const IMAGES: Record<KitPiece, string> = {
  invitation: '/images/formatos/kit-invitacion.webp',
  decoration: '/images/formatos/kit-decoracion.webp',
  keepsake: '/images/formatos/kit-cuento.webp',
  activities: '/images/formatos/kit-actividades.webp',
};

/** Miniaturas de las piezas, cada una con su nombre debajo. */
export function KitPieceThumbs({ items }: { items: readonly KitPiece[] }) {
  const t = useTranslations('Wizard.kit');
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <li key={item} className="grid content-start gap-1.5">
          <span className="relative block aspect-[4/3] overflow-hidden rounded-lg border bg-[#ffe7df]">
            <Image
              src={IMAGES[item]}
              alt={t(`pieceAlt.${item}`)}
              fill
              sizes="(min-width: 640px) 160px, 45vw"
              loading="lazy"
              unoptimized
              className="object-cover"
            />
            <IllustrativeCaption
              label={t('imageCaption')}
              className="right-1 bottom-1 px-1.5 text-[0.6rem]"
            />
          </span>
          <span className="text-xs leading-snug">{t(`includes.${item}`)}</span>
        </li>
      ))}
    </ul>
  );
}

/** «Qué trae tu kit»: las piezas de la oferta elegida (solo invitación: solo eso). */
export function KitIncludes({ offer }: { offer: KitOffer }) {
  const t = useTranslations('Wizard.kit');
  const items = offer === 'invitation' ? (['invitation'] as const) : KIT_INCLUDES;
  return (
    <section aria-labelledby="kit-includes" className="grid gap-2">
      <h2 id="kit-includes" className="text-sm font-bold">
        {offer === 'invitation' ? t('includesInvitationTitle') : t('includesTitle')}
      </h2>
      <KitPieceThumbs items={items} />
    </section>
  );
}
