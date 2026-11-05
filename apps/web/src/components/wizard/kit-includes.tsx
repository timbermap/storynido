'use client';

import { BookHeart, Mail, Puzzle, Sticker } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { KitOffer } from '@storynido/shared';

/** Lo que trae el kit completo, en un solo lugar: «¿Qué llevas?» y la muestra dicen lo mismo. */
export const KIT_INCLUDES = ['invitation', 'decoration', 'keepsake', 'activities'] as const;

const ICONS = { invitation: Mail, decoration: Sticker, keepsake: BookHeart, activities: Puzzle };

/** «Qué trae tu kit»: las piezas de la oferta elegida (solo invitación: solo eso). */
export function KitIncludes({ offer }: { offer: KitOffer }) {
  const t = useTranslations('Wizard.kit');
  const items = offer === 'invitation' ? (['invitation'] as const) : KIT_INCLUDES;
  return (
    <section aria-labelledby="kit-includes" className="grid gap-2">
      <h2 id="kit-includes" className="text-sm font-bold">
        {offer === 'invitation' ? t('includesInvitationTitle') : t('includesTitle')}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => {
          const Icon = ICONS[item];
          return (
            <li
              key={item}
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm"
            >
              <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
              {t(`includes.${item}`)}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
