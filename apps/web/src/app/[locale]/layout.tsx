import { LOCALE_DEFINITIONS } from '@storynido/shared';
import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { Analytics } from '@/components/consent/analytics';
import { ConsentBanner } from '@/components/consent/consent-banner';
import { Maintenance, PreviewOnlyBanner } from '@/components/layout/maintenance';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { routing } from '@/i18n/routing';
import { brand } from '@/lib/brand';
import { CONSENT_COOKIE, parseConsent } from '@/lib/consent';
import { fontContent, fontScript, fontUi } from '@/lib/fonts';
import { localizedAlternates } from '@/lib/seo';
import { getSiteMode } from '@/lib/server/api';
import { getDisplayCountry } from '@/lib/server/request-context';
import { SITE_URL } from '@/lib/site';

import { Providers } from './providers';

import '../globals.css';

const CLIENT_NAMESPACES = [
  'Nav',
  'Checkout',
  'Switchers',
  'Footer',
  'Consent',
  'Auth',
  'Account',
  'Stories',
  'Lessons',
  'Wizard',
  'Viewer',
  'Error',
];

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: '#fff8f1',
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Meta' });
  const title = t('title', { brand: brand.name });
  const description = t('description');
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s · ${brand.name}` },
    description,
    applicationName: brand.name,
    alternates: localizedAlternates(locale, () => '/'),
    openGraph: {
      type: 'website',
      siteName: brand.name,
      title,
      description,
      locale: LOCALE_DEFINITIONS[locale].bcp47.replace('-', '_'),
    },
    twitter: { card: 'summary_large_image', title, description },
    icons: { icon: '/icon.svg' },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [t, messages, mode, display, cookieStore] = await Promise.all([
    getTranslations('Meta'),
    getMessages(),
    getSiteMode(),
    getDisplayCountry(locale),
    cookies(),
  ]);
  const consent = parseConsent(cookieStore.get(CONSENT_COOKIE)?.value);
  // Solo se envían al navegador los textos que usan los componentes de cliente.
  const clientMessages = Object.fromEntries(
    CLIENT_NAMESPACES.filter((namespace) => namespace in messages).map((namespace) => [
      namespace,
      messages[namespace],
    ]),
  );

  return (
    <html
      lang={LOCALE_DEFINITIONS[locale].bcp47}
      // Scroll suave solo dentro de la página: al cambiar de página Next.js lo apaga y abre arriba.
      data-scroll-behavior="smooth"
      className={`${fontUi.variable} ${fontContent.variable} ${fontScript.variable}`}
    >
      <body>
        <NextIntlClientProvider messages={clientMessages}>
          <Providers locale={locale} country={display.country} consent={consent}>
            <a href="#main" className="skip-link">
              {t('skipToContent')}
            </a>
            {mode === 'maintenance' ? (
              <Maintenance />
            ) : (
              <>
                {mode === 'preview_only' && <PreviewOnlyBanner />}
                <SiteHeader />
                <main id="main">{children}</main>
                <SiteFooter />
              </>
            )}
            <ConsentBanner />
            <Analytics />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
