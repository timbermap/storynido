'use client';

import { BookHeart, Cake, GraduationCap, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Link, usePathname } from '@/i18n/navigation';

import { ExploreMenu } from './explore-menu';
import { NavMenu, NavMenuItem } from './nav-menu';
import { useOrderCounts } from './use-account-activity';

const LINK =
  'inline-flex items-center gap-2 rounded-full px-3 py-2 whitespace-nowrap transition-colors hover:text-primary aria-[current=page]:text-primary';

/**
 * Navbar de la app (reporte de navegación): Mis cuentos, Pedidos (solo si ya tiene alguno, con los
 * que están en curso) y Explorar con las tres líneas.
 */
export function AppNav() {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  const orders = useOrderCounts();
  return (
    <>
      <Link
        href="/my-stories"
        aria-current={pathname === '/my-stories' ? 'page' : undefined}
        className={LINK}
      >
        {t('myStories')}
      </Link>
      {orders !== null && orders.total > 0 && (
        <Link href={{ pathname: '/my-stories', hash: 'orders' }} className={LINK}>
          {t('orders')}
          {orders.inProgress > 0 && (
            <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs leading-5 font-bold text-primary-foreground">
              <span aria-hidden="true">{orders.inProgress}</span>
              <span className="sr-only">{t('ordersInProgress', { count: orders.inProgress })}</span>
            </span>
          )}
        </Link>
      )}
      <ExploreMenu id="menu-explore" label={t('explore')} />
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
      panelClassName="w-[min(22rem,calc(100vw-2rem))]"
      className="[&>button]:bg-action [&>button]:px-5 [&>button]:font-bold [&>button]:text-action-foreground [&>button]:hover:bg-action-hover [&>button]:hover:text-action-foreground [&>button]:aria-expanded:text-action-foreground"
      label={
        <>
          <Plus className="size-4" aria-hidden="true" />
          <span className="max-sm:sr-only">{t('createShort')}</span>
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
