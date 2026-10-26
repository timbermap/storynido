'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { logOut } from '@/lib/firebase/auth-actions';

const ROLE_LABELS = {
  customer: 'Cliente',
  admin: 'Administrador',
  superadmin: 'Superadministrador',
} as const;

/** Mi cuenta (versión inicial): se completa en la fase 12. */
export default function AccountPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p role="status" className="text-muted-foreground">
          Cargando…
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Mi cuenta</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Email</dt>
        <dd>{user.email ?? '—'}</dd>
        <dt className="text-muted-foreground">Nombre</dt>
        <dd>{user.displayName ?? '—'}</dd>
        <dt className="text-muted-foreground">Rol</dt>
        <dd>{ROLE_LABELS[role]}</dd>
      </dl>
      <Button variant="outline" onClick={() => void logOut()}>
        Cerrar sesión
      </Button>
    </main>
  );
}
