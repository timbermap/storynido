import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import { AccountLink } from './account-link';
import { HeaderCta, NavLink } from './header-links';
import { Logo } from './logo';
import { LogoLink } from './logo-link';
import { MobileMenu } from './mobile-menu';

export const HOW_IT_WORKS_ID = 'how-it-works';
export const FAQ_ID = 'faq';

/** Cada público con su color (marca v3): salvia (familias), durazno (celebraciones), lavanda (profesionales). */
export const AUDIENCE_TONES = {
  families: { dot: 'bg-[#5fae9f]', panel: 'bg-[#e4f3ef]', text: 'text-[#2f6f66]' },
  events: { dot: 'bg-[#ff8f7a]', panel: 'bg-[#ffe7df]', text: 'text-[#a33f33]' },
  professionals: { dot: 'bg-[#8c79c9]', panel: 'bg-[#eee8fa]', text: 'text-[#5b4a99]' },
} as const;

export async function SiteHeader() {
  const t = await getTranslations('Nav');

  // Un enlace por público: cada uno es una landing completa que termina en su propio "Crear".
  const links = [
    { audience: 'families', href: '/families', label: t('menuFamilies') },
    { audience: 'events', href: '/events', label: t('menuEvents') },
    { audience: 'professionals', href: '/professionals', label: t('menuProfessionals') },
  ] as const;

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
          {links.map((link) => (
            <NavLink key={link.audience} href={link.href}>
              <span
                aria-hidden="true"
                className={cn('size-2 rounded-full', AUDIENCE_TONES[link.audience].dot)}
              />
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <AccountLink />
          <HeaderCta className="px-5">{t('create')}</HeaderCta>
        </div>

        <MobileMenu>
          <nav aria-label={t('mainNav')} className="grid gap-2">
            {links.map((link) => {
              const tone = AUDIENCE_TONES[link.audience];
              return (
                <Link
                  key={link.audience}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl px-4 py-3.5 text-lg font-semibold',
                    tone.panel,
                  )}
                >
                  <span aria-hidden="true" className={cn('size-2.5 rounded-full', tone.dot)} />
                  <span className={tone.text}>{link.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 grid gap-2">
            <AccountLink variant="list" />
            <HeaderCta size="default" className="w-full">
              {t('create')}
            </HeaderCta>
          </div>
        </MobileMenu>
      </div>
    </header>
  );
}
