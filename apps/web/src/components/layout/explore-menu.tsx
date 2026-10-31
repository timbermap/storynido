'use client';

import { BookHeart, Cake, GraduationCap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { AGE_STAGES } from '@storynido/shared';

import { Link } from '@/i18n/navigation';

import { NavMenu, NavMenuItem } from './nav-menu';

/**
 * Desplegable de historias ("Historias" sin sesión, "Explorar" con sesión): Familias por etapa de
 * lectura, y los catálogos de Celebraciones y de Profesionales (estudio de catálogo).
 */
export function ExploreMenu({ label, id }: { label: ReactNode; id: string }) {
  const t = useTranslations('Nav');
  const tStages = useTranslations('Stories.stages');
  const tLines = useTranslations('Nav.lines');
  return (
    <NavMenu id={id} label={label} panelClassName="w-[22rem]">
      <div className="p-2">
        <p className="px-3 pt-2 pb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {tLines('families')}
        </p>
        <ul>
          <li>
            <Link href="/families/stories" className="group block rounded-xl">
              <NavMenuItem
                title={t('allStories')}
                text={t('allStoriesText')}
                icon={<BookHeart className="size-4" />}
              />
            </Link>
          </li>
          {AGE_STAGES.map((stage) => (
            <li key={stage.key}>
              <Link
                href={{ pathname: '/families/stories', query: { edad: String(stage.min) } }}
                className="group block rounded-xl"
              >
                <span className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition-colors group-hover:bg-[#f3eefb]">
                  {tStages(stage.key)}
                  <span className="font-normal text-muted-foreground">
                    {stage.min}–{stage.max}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <ul className="mt-1 border-t pt-1">
          <li>
            <Link href="/events/themes" className="group block rounded-xl">
              <NavMenuItem
                title={t('eventsMenu')}
                text={t('eventsText')}
                icon={<Cake className="size-4" />}
              />
            </Link>
          </li>
          <li>
            <Link href="/professionals/templates" className="group block rounded-xl">
              <NavMenuItem
                title={t('professionalsTemplates')}
                text={t('professionalsText')}
                icon={<GraduationCap className="size-4" />}
              />
            </Link>
          </li>
        </ul>
      </div>
    </NavMenu>
  );
}
