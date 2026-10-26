import { getTranslations } from 'next-intl/server';

import type { CountryCode } from '@storynido/shared';

import { Link } from '@/i18n/navigation';

import { AccountLink } from './account-link';
import { CountrySwitcher } from './country-switcher';
import { LanguageSwitcher } from './language-switcher';
import { Logo } from './logo';
import { MobileMenu } from './mobile-menu';

export const HOW_IT_WORKS_ID = 'how-it-works';
export const FAQ_ID = 'faq';

export async function SiteHeader({
  country,
  countries,
}: {
  country: CountryCode;
  countries: CountryCode[];
}) {
  const t = await getTranslations('Nav');

  const links = (
    <>
      <Link href="/stories" className="rounded-full px-3 py-2 hover:bg-muted">
        {t('stories')}
      </Link>
      <Link
        href={{ pathname: '/', hash: HOW_IT_WORKS_ID }}
        className="rounded-full px-3 py-2 hover:bg-muted"
      >
        {t('howItWorks')}
      </Link>
      <Link
        href={{ pathname: '/', hash: FAQ_ID }}
        className="rounded-full px-3 py-2 hover:bg-muted"
      >
        {t('faq')}
      </Link>
      <Link href="/blog" className="rounded-full px-3 py-2 hover:bg-muted">
        {t('blog')}
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="container-page relative flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 rounded-full">
          <Logo className="flex items-center gap-2" />
        </Link>

        <nav
          aria-label={t('mainNav')}
          className="hidden items-center gap-1 text-sm font-medium md:flex"
        >
          {links}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitcher id="language-desktop" />
          <CountrySwitcher id="country-desktop" current={country} countries={countries} />
          <AccountLink />
        </div>

        <MobileMenu>
          <nav aria-label={t('mainNav')} className="flex flex-col gap-1 text-base font-medium">
            {links}
          </nav>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <LanguageSwitcher id="language-mobile" />
            <CountrySwitcher id="country-mobile" current={country} countries={countries} />
            <AccountLink />
          </div>
        </MobileMenu>
      </div>
    </header>
  );
}
