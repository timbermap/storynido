import { getTranslations } from 'next-intl/server';

import { AccountLink } from './account-link';
import { AppNav, CreateMenu } from './app-nav';
import { Logo } from './logo';
import { Link } from '@/i18n/navigation';

/**
 * Navbar de quien ya es cliente: sin las páginas que venden (Familias, Celebraciones,
 * Profesionales). El logo lleva a Mis cuentos; "Crear" reúne las tres opciones y la cuenta tiene
 * su menú. En el celular, la navegación vive en la barra inferior.
 */
export async function AppHeader() {
  const t = await getTranslations('Nav');
  return (
    <header className="sticky top-0 z-30 border-b border-[rgb(38_50_74/0.06)] bg-background/90 backdrop-blur-md">
      <div className="container-page relative flex h-16 items-center justify-between gap-4 lg:h-[4.75rem]">
        <Link href="/my-stories" className="flex shrink-0 items-center rounded-xl">
          <Logo />
        </Link>

        <nav
          aria-label={t('mainNav')}
          className="hidden items-center gap-1 text-[0.95rem] font-semibold text-foreground/80 lg:flex"
        >
          <AppNav />
        </nav>

        <div className="flex items-center gap-2">
          <CreateMenu />
          <AccountLink />
        </div>
      </div>
    </header>
  );
}
