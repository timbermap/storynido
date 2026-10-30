import { getLocale, getTranslations } from 'next-intl/server';
import type { ComponentProps, ReactNode } from 'react';

import type { Locale } from '@storynido/shared';

import { Link } from '@/i18n/navigation';
import { brand } from '@/lib/brand';
import { LEGAL_DOCUMENTS, LEGAL_SLUGS } from '@/lib/legal';
import { SOCIAL_LINKS } from '@/lib/social';
import { cn } from '@/lib/utils';

import { CookiePreferencesButton } from './cookie-preferences-button';
import { LanguageSwitcher } from './language-switcher';
import { Logo } from './logo';
import { AUDIENCE_TONES, FAQ_ID, HOW_IT_WORKS_ID } from './site-header';

type Href = ComponentProps<typeof Link>['href'];

/** Íconos de redes dibujados en línea (sin marcas registradas en el bundle de íconos). */
const SOCIAL_ICONS: Record<string, ReactNode> = {
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  tiktok: (
    <>
      <path d="M13.5 3.5v11a3.5 3.5 0 1 1-3.5-3.5" />
      <path d="M13.5 3.5c.4 2.6 2.2 4.4 5 4.6" />
    </>
  ),
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10.2 9.4v5.2l4.5-2.6z" fill="currentColor" stroke="none" />
    </>
  ),
};

const selectDark =
  'h-9 rounded-full border border-white/15 bg-white/5 px-3 text-sm font-semibold text-white [&>option]:text-foreground';

/** Footer. Solo el idioma se cambia acá; el país va en "Mi cuenta" (somos globales). */
export async function SiteFooter() {
  const locale = (await getLocale()) as Locale;
  const [t, tLegal, tNav] = await Promise.all([
    getTranslations('Footer'),
    getTranslations('Legal'),
    getTranslations('Nav'),
  ]);

  const shipping = {
    pathname: '/legal/[document]' as const,
    params: { document: LEGAL_SLUGS[locale].shipping },
  };
  const columns: {
    title: string;
    dot?: string;
    links: { href: Href; label: string }[];
    extra?: ReactNode;
  }[] = [
    {
      title: tNav('families'),
      dot: AUDIENCE_TONES.families.dot,
      links: [
        { href: '/families', label: tNav('menuFamilies') },
        { href: '/stories', label: tNav('allStories') },
        { href: { pathname: '/', hash: HOW_IT_WORKS_ID }, label: tNav('howItWorks') },
        { href: '/create', label: tNav('familiesCreate') },
      ],
    },
    {
      title: tNav('eventsMenu'),
      dot: AUDIENCE_TONES.events.dot,
      links: [
        { href: '/events', label: tNav('eventsLanding') },
        { href: { pathname: '/create', query: { line: 'events' } }, label: tNav('eventsCreate') },
      ],
    },
    {
      title: tNav('professionals'),
      dot: AUDIENCE_TONES.professionals.dot,
      links: [
        { href: '/professionals', label: tNav('professionalsLanding') },
        {
          href: { pathname: '/create', query: { line: 'professionals' } },
          label: tNav('professionalsCreate'),
        },
      ],
    },
    {
      title: t('help'),
      links: [
        { href: { pathname: '/', hash: FAQ_ID }, label: tNav('faq') },
        { href: shipping, label: tLegal('shipping') },
        { href: '/blog', label: tNav('blog') },
      ],
      extra: (
        <Link href={{ pathname: '/', hash: 'contact' }} className="hover:text-white">
          {t('contact')}
        </Link>
      ),
    },
  ];

  return (
    <footer className="mt-24 bg-[#26324a] text-[0.95rem] text-white/70">
      <div className="container-page grid gap-12 py-16 lg:grid-cols-[1.25fr_2fr] lg:gap-16">
        <div className="max-w-sm">
          <Logo tone="light" />
          <p className="mt-5 font-display text-2xl leading-snug text-white">{t('tagline')}</p>
          <p className="mt-3 leading-relaxed">{t('pitch')}</p>
          {SOCIAL_LINKS.length > 0 && (
            <ul className="mt-6 flex gap-2" aria-label={t('follow')}>
              {SOCIAL_LINKS.map((social) => (
                <li key={social.key}>
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${social.label} (${t('newTab')})`}
                    className="grid size-10 place-items-center rounded-full border border-white/15 text-white transition hover:border-white/40 hover:bg-white/10"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="size-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {SOCIAL_ICONS[social.key]}
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 sm:gap-6">
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-white uppercase">
                {column.dot && (
                  <span aria-hidden="true" className={cn('size-1.5 rounded-full', column.dot)} />
                )}
                {column.title}
              </p>
              <ul className="mt-4 grid gap-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
                {column.extra && <li>{column.extra}</li>}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-5 py-6 text-sm lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label={t('legal')} className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_DOCUMENTS.map((doc) => (
              <Link
                key={doc}
                href={{
                  pathname: '/legal/[document]',
                  params: { document: LEGAL_SLUGS[locale][doc] },
                }}
                className="transition-colors hover:text-white"
              >
                {tLegal(doc)}
              </Link>
            ))}
            <CookiePreferencesButton className="text-left transition-colors hover:text-white" />
          </nav>
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-nowrap">
            <span className="mr-1 text-white/70">{t('preferences')}</span>
            <LanguageSwitcher id="language-footer" selectClassName={selectDark} />
          </div>
        </div>
        <p className="container-page pb-8 text-xs text-white/60">
          {t('rights', { year: new Date().getFullYear(), brand: brand.name })}
        </p>
      </div>
    </footer>
  );
}
