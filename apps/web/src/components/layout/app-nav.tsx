'use client';

import { BookHeart, Cake, GraduationCap, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import type { Channel } from '@storynido/shared';

import { Link, usePathname } from '@/i18n/navigation';
import { AUDIENCE_TONES } from '@/lib/audience-tones';
import type { MyStoriesTab } from '@/lib/my-stories-tabs';
import { cn } from '@/lib/utils';

import { NavMenu, NavMenuItem } from './nav-menu';
import { useDraftCount, useOrderCounts } from './use-account-activity';

const LINK =
  'inline-flex items-center gap-2 rounded-full px-3 py-2 whitespace-nowrap transition-colors hover:text-primary aria-[current=page]:text-primary';

/** Las tres puertas: el catálogo de cada línea y el prefijo de sus páginas. */
export const CATALOG_LINES = [
  { line: 'families', href: '/families/stories', prefix: '/families' },
  { line: 'events', href: '/events/themes', prefix: '/events' },
  { line: 'professionals', href: '/professionals/templates', prefix: '/professionals' },
] as const satisfies readonly { line: Channel; href: string; prefix: string }[];

export function catalogHref(line: Channel) {
  return CATALOG_LINES.find((item) => item.line === line)?.href ?? '/families/stories';
}

/** La página es de esa línea: su catálogo o cualquier página bajo su prefijo. */
export function isLinePath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Navbar de la app (opción 1, "tres puertas"): los catálogos de Familias, Celebraciones y
 * Profesionales, cada uno con el punto de su color.
 */
export function AppNav() {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  return (
    <>
      {CATALOG_LINES.map(({ line, href, prefix }) => (
        <Link
          key={line}
          href={href}
          aria-current={isLinePath(pathname, prefix) ? 'page' : undefined}
          className={LINK}
        >
          <span
            aria-hidden="true"
            className={cn('size-2 rounded-full', AUDIENCE_TONES[line].dot)}
          />
          {t(line)}
        </Link>
      ))}
    </>
  );
}

/** Punto salvia: hay pedidos en camino (en lugar de un contador rojo). */
export function InProgressDot({ count, className }: { count: number; className?: string }) {
  const t = useTranslations('Nav');
  if (count <= 0) return null;
  return (
    <>
      <span
        aria-hidden="true"
        className={cn('size-2 shrink-0 rounded-full bg-[#5fae9f]', className)}
      />
      <span className="sr-only">{t('ordersInProgress', { count })}</span>
    </>
  );
}

/** Contador chico y neutro de los ítems del menú. */
function CountPill({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <span className="grid min-w-6 place-items-center rounded-full bg-muted px-1.5 text-xs leading-5 font-semibold text-muted-foreground">
      {value}
    </span>
  );
}

/**
 * "Mis cuentos": el nombre lleva a la página y la flecha abre los estados (en creación, en
 * curso, terminados) y los personajes.
 */
export function MyStoriesMenu({ className }: { className?: string }) {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  const orders = useOrderCounts();
  const drafts = useDraftCount();
  const items: { tab: MyStoriesTab; label: string; count: number | null }[] = [
    { tab: 'en-creacion', label: t('storiesCreating'), count: drafts },
    { tab: 'en-curso', label: t('storiesInProgress'), count: orders?.inProgress ?? null },
    { tab: 'terminados', label: t('storiesDone'), count: orders?.done ?? null },
  ];
  const ROW =
    'flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground transition-colors group-hover:bg-[#f3eefb]';
  return (
    <NavMenu
      id="menu-my-stories"
      align="end"
      href="/my-stories"
      current={pathname === '/my-stories'}
      toggleLabel={t('myStoriesToggle')}
      className={cn('text-[0.95rem] font-semibold text-foreground/80', className)}
      panelClassName="w-[15rem]"
      label={
        <>
          {t('myStories')}
          <InProgressDot count={orders?.inProgress ?? 0} />
        </>
      }
    >
      <ul className="p-2">
        {items.map(({ tab, label, count }) => (
          <li key={tab}>
            <Link
              href={{ pathname: '/my-stories', query: { estado: tab } }}
              className="group block rounded-xl"
            >
              <span className={ROW}>
                {label}
                <CountPill value={count} />
              </span>
            </Link>
          </li>
        ))}
        <li className="mt-1 border-t pt-1">
          <Link
            href={{ pathname: '/my-stories', query: { estado: 'personajes' } }}
            className="group block rounded-xl"
          >
            <span className={ROW}>{t('characters')}</span>
          </Link>
        </li>
      </ul>
    </NavMenu>
  );
}

const OPTIONS = [
  { line: 'families', icon: BookHeart },
  { line: 'events', icon: Cake },
  { line: 'professionals', icon: GraduationCap },
] as const;

/** Las tres opciones de "Crear" (en el menú del navbar y en la hoja de la barra inferior). */
export function CreateOptions() {
  const tNew = useTranslations('Account.myStories.newOptions');
  return (
    <ul className="p-2">
      {OPTIONS.map(({ line, icon: Icon }) => (
        <li key={line}>
          <Link
            href={{ pathname: '/create', query: { line } }}
            data-track="new_choice"
            data-track-line={line}
            className="group block rounded-xl"
          >
            <NavMenuItem
              title={tNew(`${line}.title`)}
              text={tNew(`${line}.text`)}
              icon={<Icon className="size-4" />}
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** "Crear": un solo botón principal con las tres opciones adentro. */
export function CreateMenu({ children, className }: { children?: ReactNode; className?: string }) {
  const t = useTranslations('Nav');
  return (
    <NavMenu
      id="menu-create"
      align="end"
      className={className}
      panelClassName="w-[min(22rem,calc(100vw-2rem))]"
      triggerClassName="bg-action px-5 font-bold text-action-foreground shadow-sm hover:bg-action-hover hover:text-action-foreground aria-expanded:text-action-foreground"
      label={
        <>
          <Plus className="size-4" aria-hidden="true" />
          <span className="max-sm:sr-only">{t('createShort')}</span>
        </>
      }
    >
      <CreateOptions />
      {children}
    </NavMenu>
  );
}
