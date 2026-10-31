'use client';

import { BookHeart, Cake, GraduationCap, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Link, usePathname } from '@/i18n/navigation';

import { NavMenu, NavMenuItem } from './nav-menu';
import { useInProgressOrders } from './use-account-activity';

const LINK =
  'inline-flex items-center gap-2 rounded-full px-3 py-2 whitespace-nowrap transition-colors hover:text-primary aria-[current=page]:text-primary';

/** Enlaces del navbar de la app: Mis cuentos (con los pedidos en curso) y Explorar. */
export function AppNav() {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  const inProgress = useInProgressOrders();
  return (
    <>
      <Link
        href="/my-stories"
        aria-current={pathname === '/my-stories' ? 'page' : undefined}
        className={LINK}
      >
        {t('myStories')}
        {inProgress !== null && inProgress > 0 && (
          <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs leading-5 font-bold text-primary-foreground">
            <span aria-hidden="true">{inProgress}</span>
            <span className="sr-only">{t('ordersInProgress', { count: inProgress })}</span>
          </span>
        )}
      </Link>
      <Link
        href="/stories"
        aria-current={pathname === '/stories' ? 'page' : undefined}
        className={LINK}
      >
        {t('explore')}
      </Link>
    </>
  );
}

const OPTIONS = [
  { line: 'families', icon: BookHeart },
  { line: 'events', icon: Cake },
  { line: 'professionals', icon: GraduationCap },
] as const;

/** "Crear": un solo botón principal con las tres opciones adentro. */
export function CreateMenu({ children }: { children?: ReactNode }) {
  const t = useTranslations('Nav');
  const tNew = useTranslations('Account.myStories.newOptions');
  return (
    <NavMenu
      id="menu-create"
      align="end"
      panelClassName="w-[22rem]"
      className="[&>button]:bg-action [&>button]:px-5 [&>button]:font-bold [&>button]:text-action-foreground [&>button]:hover:bg-action-hover [&>button]:hover:text-action-foreground [&>button]:aria-expanded:text-action-foreground"
      label={
        <>
          <Plus className="size-4" aria-hidden="true" />
          {t('createShort')}
        </>
      }
    >
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
      {children}
    </NavMenu>
  );
}
