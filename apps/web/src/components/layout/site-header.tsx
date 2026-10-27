import {
  BookHeart,
  BookOpen,
  Globe,
  GraduationCap,
  Newspaper,
  PartyPopper,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ComponentProps } from 'react';

import type { CountryCode, Locale } from '@storynido/shared';

import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { getCollections } from '@/lib/server/api';

import { AccountLink } from './account-link';
import { CountrySwitcher } from './country-switcher';
import { LanguageSwitcher } from './language-switcher';
import { Logo } from './logo';
import { MobileMenu } from './mobile-menu';
import { NavMenu, NavMenuItem } from './nav-menu';

export const HOW_IT_WORKS_ID = 'how-it-works';
export const FAQ_ID = 'faq';

type Href = ComponentProps<typeof Link>['href'];

interface MenuLink {
  href: Href;
  title: string;
  text?: string;
  icon?: React.ReactNode;
}

const icon = 'size-[1.1rem]';

export async function SiteHeader({
  country,
  countries,
}: {
  country: CountryCode;
  countries: CountryCode[];
}) {
  const locale = (await getLocale()) as Locale;
  const [t, tSwitch, collections] = await Promise.all([
    getTranslations('Nav'),
    getTranslations('Switchers'),
    getCollections(locale, 'families').catch(() => []),
  ]);

  // Cada línea comercial tiene su menú: qué es y cómo empezar.
  const menus: { id: string; label: string; links: MenuLink[] }[] = [
    {
      id: 'menu-stories',
      label: t('stories'),
      links: [
        {
          href: '/stories',
          title: t('allStories'),
          text: t('allStoriesText'),
          icon: <BookOpen className={icon} />,
        },
        ...collections.map((collection) => ({
          href: { pathname: '/stories' as const, query: { coleccion: collection.slug } },
          title: collection.name,
          text: collection.description,
          icon: <BookHeart className={icon} />,
        })),
        {
          href: { pathname: '/' as const, hash: HOW_IT_WORKS_ID },
          title: t('howItWorks'),
          icon: <Sparkles className={icon} />,
        },
        { href: '/blog', title: t('blog'), icon: <Newspaper className={icon} /> },
      ],
    },
    {
      id: 'menu-events',
      label: t('eventsMenu'),
      links: [
        {
          href: '/events',
          title: t('eventsLanding'),
          text: t('eventsText'),
          icon: <PartyPopper className={icon} />,
        },
        {
          href: { pathname: '/create', query: { line: 'events' } },
          title: t('eventsCreate'),
          text: t('eventsCreateText'),
          icon: <WandSparkles className={icon} />,
        },
      ],
    },
    {
      id: 'menu-professionals',
      label: t('professionals'),
      links: [
        {
          href: '/professionals',
          title: t('professionalsLanding'),
          text: t('professionalsText'),
          icon: <GraduationCap className={icon} />,
        },
        {
          href: { pathname: '/create', query: { line: 'professionals' } },
          title: t('professionalsCreate'),
          text: t('professionalsCreateText'),
          icon: <WandSparkles className={icon} />,
        },
      ],
    },
  ];

  const region = (suffix: string) => (
    <div className="grid gap-3 p-3">
      <LanguageSwitcher id={`language-${suffix}`} />
      <CountrySwitcher id={`country-${suffix}`} current={country} countries={countries} />
    </div>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-[rgb(55_37_75/0.06)] bg-[rgb(255_251_246/0.94)] backdrop-blur">
      <div className="container-page relative flex h-[4.5rem] items-center justify-between gap-4 lg:h-[5.25rem]">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-xl">
          <Logo className="flex items-center gap-2.5" />
        </Link>

        <nav
          aria-label={t('mainNav')}
          className="hidden items-center gap-1 text-[0.95rem] font-extrabold text-foreground/85 lg:flex"
        >
          {menus.map((menu) => (
            <NavMenu key={menu.id} id={menu.id} label={menu.label}>
              <ul>
                {menu.links.map((link) => (
                  <li key={link.title}>
                    <Link href={link.href} className="group block rounded-xl">
                      <NavMenuItem title={link.title} text={link.text} icon={link.icon} />
                    </Link>
                  </li>
                ))}
              </ul>
            </NavMenu>
          ))}
        </nav>

        <div className="hidden items-center gap-1.5 lg:flex">
          <NavMenu
            id="menu-region"
            align="end"
            label={
              <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-muted-foreground">
                <Globe aria-hidden="true" className="size-[1.15rem]" />
                <span className="sr-only">{t('region')}: </span>
                {locale.toUpperCase()} · {country}
              </span>
            }
          >
            <p className="px-3 pt-2 text-xs font-black tracking-[0.1em] text-muted-foreground uppercase">
              {t('region')}
            </p>
            {region('desktop')}
          </NavMenu>
          <AccountLink />
          <Link
            href="/create"
            className={buttonVariants({ size: 'sm', className: 'h-11 rounded-full px-6' })}
          >
            {t('create')}
          </Link>
        </div>

        <MobileMenu>
          <nav aria-label={t('mainNav')} className="grid gap-5">
            {menus.map((menu) => (
              <section key={menu.id} aria-labelledby={`${menu.id}-mobile`}>
                <h2
                  id={`${menu.id}-mobile`}
                  className="px-3 font-sans text-xs font-black tracking-[0.1em] text-muted-foreground uppercase"
                >
                  {menu.label}
                </h2>
                <ul className="mt-1">
                  {menu.links.map((link) => (
                    <li key={link.title}>
                      <Link href={link.href} className="group block rounded-xl">
                        <NavMenuItem title={link.title} icon={link.icon} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>
          <div className="mt-5 rounded-2xl bg-secondary/50">
            <p className="px-3 pt-3 text-xs font-black tracking-[0.1em] text-muted-foreground uppercase">
              {t('region')} · {tSwitch(`countries.${country}`)}
            </p>
            {region('mobile')}
          </div>
          <div className="mt-4 grid gap-2">
            <AccountLink />
            <Link href="/create" className={buttonVariants({ className: 'w-full rounded-full' })}>
              {t('create')}
            </Link>
          </div>
        </MobileMenu>
      </div>
    </header>
  );
}
