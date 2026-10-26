'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { SignInPanel } from '@/components/auth/sign-in-panel';
import { useRouter } from '@/i18n/navigation';
import { brand } from '@/lib/brand';

export function LoginView() {
  const t = useTranslations('Auth');
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/account');
  }, [loading, user, router]);

  return (
    <section className="container-page flex min-h-[70vh] max-w-sm flex-col justify-center gap-8 py-12">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold">{t('title', { brand: brand.name })}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </header>
      <SignInPanel />
    </section>
  );
}
