'use client';

import { BookHeart, Plus, ShoppingBag, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import { isFocusPath } from './focus-header';
import { useInProgressOrders } from './use-account-activity';

/**
 * Barra inferior del celular para quien ya es cliente (zona del pulgar): Mis cuentos, Crear,
 * Pedidos y Cuenta. No aparece mientras se crea o se paga (modo foco).
 */
export function BottomTabs() {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  const inProgress = useInProgressOrders();
  if (isFocusPath(pathname)) return null;

  const tab = (active: boolean) =>
    cn(
      'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-foreground/70',
      active && 'text-primary',
    );

  return (
    <nav
      aria-label={t('tabsNav')}
      data-bottom-tabs
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[rgb(38_50_74/0.08)] bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <Link
        href="/my-stories"
        aria-current={pathname === '/my-stories' ? 'page' : undefined}
        className={tab(pathname === '/my-stories')}
      >
        <BookHeart className="size-5" aria-hidden="true" />
        {t('myStories')}
      </Link>
      <Link
        href="/new"
        className="flex flex-1 items-center justify-center"
        aria-label={t('create')}
      >
        <span className="grid size-12 -translate-y-2 place-items-center rounded-full bg-action text-action-foreground shadow-lg">
          <Plus className="size-6" aria-hidden="true" />
        </span>
      </Link>
      <Link href={{ pathname: '/my-stories', hash: 'orders' }} className={tab(false)}>
        <span className="relative">
          <ShoppingBag className="size-5" aria-hidden="true" />
          {inProgress !== null && inProgress > 0 && (
            <span className="absolute -top-1.5 -right-2.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.65rem] leading-4 font-bold text-primary-foreground">
              <span aria-hidden="true">{inProgress}</span>
              <span className="sr-only">{t('ordersInProgress', { count: inProgress })}</span>
            </span>
          )}
        </span>
        {t('orders')}
      </Link>
      <Link
        href="/account"
        aria-current={pathname === '/account' ? 'page' : undefined}
        className={tab(pathname === '/account')}
      >
        <UserRound className="size-5" aria-hidden="true" />
        {t('accountTab')}
      </Link>
    </nav>
  );
}
