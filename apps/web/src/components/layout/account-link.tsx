'use client';

import {
  BookHeart,
  Compass,
  CircleHelp,
  LogOut,
  ShieldCheck,
  ShoppingBag,
  Settings,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/components/auth/auth-provider';
import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { logOut } from '@/lib/firebase/auth-actions';

import { NavMenu, NavMenuItem } from './nav-menu';

/** Iniciales para el avatar: del nombre o, si no hay, del email. */
function initials(name: string | null, email: string | null): string {
  const source = [name?.trim(), email?.split('@')[0]].find(Boolean) ?? '?';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? (parts[1]?.[0] ?? '') : '')).toUpperCase();
}

/**
 * Sin sesión: "Iniciar sesión". Con sesión: menú de la cuenta (iniciales) con sus cuentos,
 * preferencias y salir. `variant="list"` para el menú del celular.
 */
export function AccountLink({ variant = 'menu' }: { variant?: 'menu' | 'list' }) {
  const t = useTranslations('Nav');
  const { user, signedIn, loading, role } = useAuth();
  // Después de entrar se vuelve a esta página.
  const pathname = usePathname();

  // Mientras se lee la sesión, un lugar vacío del mismo tamaño: sin "Iniciar sesión" que
  // después cambia al avatar.
  if (loading) {
    return <span aria-hidden="true" className="inline-block size-8 rounded-full bg-muted" />;
  }

  if (!signedIn || !user) {
    return (
      <Link
        href={{ pathname: '/login', query: pathname ? { next: pathname } : {} }}
        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
      >
        {t('signIn')}
      </Link>
    );
  }

  const name = user.displayName ?? user.email ?? '';
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL;
  const isStaff = role === 'admin' || role === 'superadmin';
  // Menú de la cuenta (reporte de navegación): lo propio, los pedidos, los ajustes y la ayuda.
  const links = [
    {
      href: '/my-stories',
      title: t('myStories'),
      icon: <BookHeart className="size-4" />,
    },
    {
      href: { pathname: '/my-stories', hash: 'orders' },
      title: t('orders'),
      icon: <ShoppingBag className="size-4" />,
    },
    {
      // En el celular no hay "Explorar" en la barra: vive acá.
      href: '/families/stories',
      title: t('explore'),
      icon: <Compass className="size-4" />,
      mobileOnly: true,
    },
    {
      href: '/account',
      title: t('preferences'),
      icon: <Settings className="size-4" />,
    },
    {
      href: '/faq',
      title: t('help'),
      icon: <CircleHelp className="size-4" />,
    },
  ] as const;
  const adminLink =
    isStaff && adminUrl ? (
      <a href={adminUrl} className="group block rounded-xl">
        <NavMenuItem title={t('adminPanel')} icon={<ShieldCheck className="size-4" />} />
      </a>
    ) : null;
  const avatar = (
    <span
      aria-hidden="true"
      className="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
    >
      {initials(user.displayName, user.email)}
    </span>
  );
  const signOut = (
    <button
      type="button"
      onClick={() => void logOut()}
      className="group block w-full rounded-xl text-left"
    >
      <NavMenuItem title={t('signOut')} icon={<LogOut className="size-4" />} />
    </button>
  );

  if (variant === 'list') {
    return (
      <div className="rounded-2xl border bg-card p-2">
        <p className="flex items-center gap-3 px-3 py-2">
          {avatar}
          <span className="truncate text-sm font-semibold">{name}</span>
        </p>
        {links.map((link) => (
          <Link key={link.title} href={link.href} className="group block rounded-xl">
            <NavMenuItem title={link.title} icon={link.icon} />
          </Link>
        ))}
        {adminLink}
        {signOut}
      </div>
    );
  }

  return (
    <NavMenu
      id="menu-account"
      align="end"
      panelClassName="w-[17rem]"
      label={
        <>
          {avatar}
          <span className="sr-only">{t('accountMenu')}</span>
        </>
      }
    >
      <div className="p-2">
        <p className="truncate border-b px-3 pt-1 pb-3 text-sm text-muted-foreground">
          {t('signedInAs')} <span className="font-semibold text-foreground">{name}</span>
        </p>
        <ul className="pt-1">
          {links.map((link) => (
            <li key={link.title} className={'mobileOnly' in link ? 'lg:hidden' : undefined}>
              <Link href={link.href} className="group block rounded-xl">
                <NavMenuItem title={link.title} icon={link.icon} />
              </Link>
            </li>
          ))}
          {adminLink && <li>{adminLink}</li>}
          <li>{signOut}</li>
        </ul>
      </div>
    </NavMenu>
  );
}
