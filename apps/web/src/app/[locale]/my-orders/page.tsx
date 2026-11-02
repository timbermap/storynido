'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { OrdersList } from '@/components/account/orders-list';
import { useAuth } from '@/components/auth/auth-provider';
import { useRouter } from '@/i18n/navigation';

/** Mis pedidos: la lista de pedidos en vivo, con su estado y «Pedir de nuevo» (DECISIONS 222). */
export default function MyOrdersPage() {
  const t = useTranslations('Account.myStories');
  const { user, signedIn, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !signedIn) router.replace('/login');
  }, [loading, signedIn, router]);

  if (loading || !user || !signedIn) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <p role="status" className="text-muted-foreground">
          {t('loading')}
        </p>
      </section>
    );
  }

  return (
    <section className="container-page grid max-w-3xl gap-8 py-12">
      <OrdersList uid={user.uid} heading="h1" showEmpty />
    </section>
  );
}
