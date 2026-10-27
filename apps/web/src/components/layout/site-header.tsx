import {
  ArrowRight,
  BookHeart,
  BookOpen,
  GraduationCap,
  Newspaper,
  PartyPopper,
  Sparkles,
} from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ComponentProps, ReactNode } from 'react';

import type { Locale } from '@storynido/shared';

import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { getCollections } from '@/lib/server/api';
import { cn } from '@/lib/utils';

import { AccountLink } from './account-link';
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
  icon?: ReactNode;
}

/** Cada público con su color: lavanda (familias), durazno (eventos), menta (profesionales). */
export const AUDIENCE_TONES = {
  families: { dot: 'bg-primary', panel: 'bg-[#f6eefa]', text: 'text-primary' },
  events: { dot: 'bg-[#d9895c]', panel: 'bg-[#fbeee6]', text: 'text-[#a8633b]' },
  professionals: { dot: 'bg-[#4f9e82]', panel: 'bg-[#eaf5ef]', text: 'text-[#357a62]' },
} as const;

type Audience = keyof typeof AUDIENCE_TONES;

const icon = 'size-[1.05rem]';

export async function SiteHeader() {
  const locale = (await getLocale()) as Locale;
  const [t, tAudience, collections, eventCollections, proCollections] = await Promise.all([
    getTranslations('Nav'),
    getTranslations('Home.audience'),
    getCollections(locale, 'families').catch(() => []),
    getCollections(locale, 'events').catch(() => []),
    getCollections(locale, 'professionals').catch(() => []),
  ]);

  // Un menú por público: qué es, adónde ir y cómo empezar.
  const menus: {
    audience: Audience;
    label: string;
    cta: { href: Href; label: string };
    links: MenuLink[];
  }[] = [
    {
      audience: 'families',
      label: t('families'),
      cta: { href: '/create', label: t('familiesCreate') },
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
      audience: 'events',
      label: t('eventsMenu'),
      cta: { href: { pathname: '/create', query: { line: 'events' } }, label: t('eventsCreate') },
      links: [
        {
          href: '/events',
          title: t('eventsLanding'),
          text: t('eventsText'),
          icon: <PartyPopper className={icon} />,
        },
        ...eventCollections.map((collection) => ({
          href: '/events' as const,
          title: collection.name,
          icon: <BookHeart className={icon} />,
        })),
      ],
    },
    {
      audience: 'professionals',
      label: t('professionals'),
      cta: {
        href: { pathname: '/create', query: { line: 'professionals' } },
        label: t('professionalsCreate'),
      },
      links: [
        {
          href: '/professionals',
          title: t('professionalsLanding'),
          text: t('professionalsText'),
          icon: <GraduationCap className={icon} />,
        },
        ...proCollections.map((collection) => ({
          href: '/professionals' as const,
          title: collection.name,
          icon: <BookHeart className={icon} />,
        })),
      ],
    },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[rgb(52_42_64/0.06)] bg-background/90 backdrop-blur-md">
      <div className="container-page relative flex h-16 items-center justify-between gap-4 lg:h-[4.75rem]">
        <Link href="/" className="flex shrink-0 items-center rounded-xl">
          <Logo />
        </Link>

        <nav
          aria-label={t('mainNav')}
          className="hidden items-center gap-1 text-[0.95rem] font-semibold text-foreground/80 lg:flex"
        >
          {menus.map((menu) => {
            const tone = AUDIENCE_TONES[menu.audience];
            return (
              <NavMenu
                key={menu.audience}
                id={`menu-${menu.audience}`}
                panelClassName="w-[36rem]"
                label={
                  <>
                    <span aria-hidden="true" className={cn('size-2 rounded-full', tone.dot)} />
                    {menu.label}
                  </>
                }
              >
                <div className="grid grid-cols-[13rem_1fr]">
                  <div className={cn('flex flex-col p-5', tone.panel)}>
                    <p className={cn('text-xs font-bold tracking-[0.14em] uppercase', tone.text)}>
                      {menu.label}
                    </p>
                    <p className="mt-2 text-[0.95rem] leading-snug text-foreground/80">
                      {tAudience(`${menu.audience}.text`)}
                    </p>
                    <Link
                      href={menu.cta.href}
                      className={cn(
                        'mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold hover:underline',
                        tone.text,
                      )}
                    >
                      {menu.cta.label}
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  </div>
                  <ul className="p-2">
                    {menu.links.map((link) => (
                      <li key={link.title}>
                        <Link href={link.href} className="group block rounded-xl">
                          <NavMenuItem title={link.title} text={link.text} icon={link.icon} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </NavMenu>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <AccountLink />
          <Link href="/create" className={buttonVariants({ size: 'sm', className: 'px-5' })}>
            {t('create')}
          </Link>
        </div>

        <MobileMenu>
          <nav aria-label={t('mainNav')} className="grid gap-4">
            {menus.map((menu) => {
              const tone = AUDIENCE_TONES[menu.audience];
              return (
                <section
                  key={menu.audience}
                  aria-labelledby={`menu-${menu.audience}-mobile`}
                  className={cn('rounded-2xl p-3', tone.panel)}
                >
                  <h2
                    id={`menu-${menu.audience}-mobile`}
                    className={cn(
                      'flex items-center gap-2 px-2 font-sans text-xs font-bold tracking-[0.14em] uppercase',
                      tone.text,
                    )}
                  >
                    <span aria-hidden="true" className={cn('size-2 rounded-full', tone.dot)} />
                    {menu.label}
                  </h2>
                  <ul className="mt-1">
                    {[...menu.links, { href: menu.cta.href, title: menu.cta.label }].map((link) => (
                      <li key={link.title}>
                        <Link
                          href={link.href}
                          className="block rounded-lg px-2 py-2 font-semibold hover:bg-white/60"
                        >
                          {link.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </nav>
          <div className="mt-4 grid gap-2">
            <AccountLink variant="list" />
            <Link href="/create" className={buttonVariants({ className: 'w-full' })}>
              {t('create')}
            </Link>
          </div>
        </MobileMenu>
      </div>
    </header>
  );
}
