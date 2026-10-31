'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { SignInPanel } from '@/components/auth/sign-in-panel';
import { useRouter } from '@/i18n/navigation';
import { brand } from '@/lib/brand';
import { afterLoginPath } from '@/lib/firebase/auth-actions';

/** Solo rutas internas: nada de "//otro-sitio" ni URLs absolutas. */
const safePath = (path: string | null) =>
  path?.startsWith('/') && !path.startsWith('//') ? path : null;

export function LoginView() {
  const t = useTranslations('Auth');
  const { signedIn, loading } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get('next');

  // Con sesión: a Mis cuentos (solo se vuelve a un pago o a un pedido). Nunca al creador ni a los
  // ajustes.
  useEffect(() => {
    if (loading || !signedIn) return;
    const target = afterLoginPath(safePath(next));
    if (target) {
      window.location.replace(target);
    } else {
      router.replace('/my-stories');
    }
  }, [loading, signedIn, router, next]);

  return (
    <section className="container-page flex min-h-[70vh] max-w-sm flex-col justify-center gap-8 py-12">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-medium">{t('title', { brand: brand.name })}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </header>
      <SignInPanel />
    </section>
  );
}
