'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { SignInPanel } from '@/components/auth/sign-in-panel';
import { brand } from '@/lib/brand';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/cuenta');
  }, [loading, user, router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-12">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Entrá a {brand.name}</h1>
        <p className="text-muted-foreground">Guardá tus cuentos y seguí tus pedidos.</p>
      </header>
      <SignInPanel />
    </main>
  );
}
