import { getTranslations } from 'next-intl/server';

import type { CountryCode } from '@storynido/shared';

import { buttonVariants } from '@/components/ui/button';
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

  const linkClass =
    'rounded-full px-2.5 py-2 whitespace-nowrap transition-colors hover:text-primary';
  const links = (
    <>
      <Link href="/stories" className={linkClass}>
        {t('stories')}
      </Link>
      <Link href={{ pathname: '/', hash: HOW_IT_WORKS_ID }} className={linkClass}>
        {t('howItWorks')}
      </Link>
      <Link href={{ pathname: '/', hash: FAQ_ID }} className={linkClass}>
        {t('faq')}
      </Link>
      <Link href="/blog" className={linkClass}>
        {t('blog')}
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-[rgb(55_37_75/0.07)] bg-[rgb(255_251_246/0.96)] backdrop-blur">
      <div className="container-page relative flex h-[4.5rem] items-center justify-between gap-4 lg:h-[5.5rem]">
        <Link href="/" className="flex items-center gap-2.5 rounded-xl">
          <Logo className="flex items-center gap-2.5" />
        </Link>

        <nav
          aria-label={t('mainNav')}
          className="hidden items-center text-[0.92rem] font-extrabold text-muted-foreground xl:flex"
        >
          {links}
        </nav>

        <div className="hidden items-center gap-2 xl:flex">
          <LanguageSwitcher id="language-desktop" />
          <CountrySwitcher id="country-desktop" current={country} countries={countries} />
          <AccountLink />
          <Link href="/stories" className={buttonVariants({ size: 'sm' })}>
            {t('create')}
          </Link>
        </div>

        <MobileMenu>
          <nav
            aria-label={t('mainNav')}
            className="flex flex-col gap-1 text-base font-extrabold text-muted-foreground"
          >
            {links}
          </nav>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <LanguageSwitcher id="language-mobile" />
            <CountrySwitcher id="country-mobile" current={country} countries={countries} />
            <AccountLink />
          </div>
          <Link href="/stories" className={buttonVariants({ className: 'mt-4 w-full' })}>
            {t('create')}
          </Link>
        </MobileMenu>
      </div>
    </header>
  );
}
