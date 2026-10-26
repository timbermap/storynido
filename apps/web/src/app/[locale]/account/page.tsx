'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { ApiError } from '@storynido/shared';

import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { logOut } from '@/lib/firebase/auth-actions';

/** Mi cuenta (versión inicial): se completa en la fase 12. */
export default function AccountPage() {
  const t = useTranslations('Account');
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [apiCheck, setApiCheck] = useState<string>(t('verifying'));

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  // Confirma la sesión contra la API (verifica el token en el servidor).
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    api('me', { signal: controller.signal })
      .then((me) => {
        setApiCheck(t('verified', { role: t(`roles.${me.role}`) }));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setApiCheck(
          error instanceof ApiError
            ? t('apiError', { message: error.message })
            : t('apiUnreachable'),
        );
      });
    return () => {
      controller.abort();
    };
  }, [user, t]);

  if (loading || !user) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <p role="status" className="text-muted-foreground">
          {t('loading')}
        </p>
      </section>
    );
  }

  return (
    <section className="container-page flex min-h-[60vh] max-w-md flex-col justify-center gap-6 py-12">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t('email')}</dt>
        <dd>{user.email ?? '—'}</dd>
        <dt className="text-muted-foreground">{t('name')}</dt>
        <dd>{user.displayName ?? '—'}</dd>
        <dt className="text-muted-foreground">{t('role')}</dt>
        <dd>{t(`roles.${role}`)}</dd>
        <dt className="text-muted-foreground">{t('api')}</dt>
        <dd role="status">{apiCheck}</dd>
      </dl>
      <Button variant="outline" onClick={() => void logOut()}>
        {t('signOut')}
      </Button>
    </section>
  );
}
