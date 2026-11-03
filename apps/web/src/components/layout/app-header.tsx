import { getTranslations } from 'next-intl/server';

import { AccountLink } from './account-link';
import { AppNav, CreateMenu, MyStoriesMenu } from './app-nav';
import { Logo } from './logo';
import { LogoLink } from './logo-link';

/**
 * Navbar de quien ya es cliente (opción 1, "tres puertas"): los catálogos de las tres líneas al
 * centro; Mis cuentos, Crear y la cuenta a la derecha. El logo lleva a la home con sesión
 * (DECISIONS 220). En el celular solo quedan el logo y el avatar: el resto vive en la barra
 * inferior (AppTabBar).
 */
export async function AppHeader() {
  const t = await getTranslations('Nav');
  return (
    <header className="sticky top-0 z-30 border-b border-[rgb(38_50_74/0.06)] bg-background/90 backdrop-blur-md">
      <div className="container-page relative flex h-16 items-center justify-between gap-4 lg:h-[4.75rem]">
        <LogoLink>
          <Logo />
        </LogoLink>

        <nav
          aria-label={t('mainNav')}
          className="hidden items-center gap-1 text-[0.95rem] font-semibold text-foreground/80 lg:flex"
        >
          <AppNav />
        </nav>

        <div className="flex items-center gap-2">
          <MyStoriesMenu className="max-lg:hidden" />
          <CreateMenu className="max-lg:hidden" />
          <AccountLink />
        </div>
      </div>
    </header>
  );
}
