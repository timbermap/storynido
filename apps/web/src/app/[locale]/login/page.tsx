import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { brand } from '@/lib/brand';

import { LoginView } from './login-view';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: 'Auth' });
  return { title: t('title', { brand: brand.name }), robots: { index: false } };
}

export default function LoginPage() {
  return <LoginView />;
}
