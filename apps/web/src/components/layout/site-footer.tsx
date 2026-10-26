import { getLocale, getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { Link } from '@/i18n/navigation';
import { brand } from '@/lib/brand';
import { LEGAL_DOCUMENTS, LEGAL_SLUGS } from '@/lib/legal';

import { CookiePreferencesButton } from './cookie-preferences-button';
import { Logo } from './logo';

export async function SiteFooter() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations('Footer');
  const tLegal = await getTranslations('Legal');
  const tNav = await getTranslations('Nav');

  return (
    <footer className="mt-24 border-t bg-[#f5eff4]">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo className="flex items-center gap-2" />
          <p className="text-sm text-muted-foreground">{t('tagline')}</p>
        </div>
        <nav aria-label={t('company')} className="flex flex-col gap-2 text-sm">
          <p className="font-semibold">{t('company')}</p>
          <Link href="/stories" className="hover:underline">
            {tNav('stories')}
          </Link>
          <Link href="/blog" className="hover:underline">
            {tNav('blog')}
          </Link>
          <a href="mailto:hola@storynido.com" className="hover:underline">
            {t('contact')}: hola@storynido.com
          </a>
        </nav>
        <nav aria-label={t('legal')} className="flex flex-col gap-2 text-sm">
          <p className="font-semibold">{t('legal')}</p>
          {LEGAL_DOCUMENTS.map((doc) => (
            <Link
              key={doc}
              href={{
                pathname: '/legal/[document]',
                params: { document: LEGAL_SLUGS[locale][doc] },
              }}
              className="hover:underline"
            >
              {tLegal(doc)}
            </Link>
          ))}
          <CookiePreferencesButton />
        </nav>
      </div>
      <p className="container-page border-t py-6 text-xs text-muted-foreground">
        {t('rights', { year: new Date().getFullYear(), brand: brand.name })}
      </p>
    </footer>
  );
}
