'use client';

import type { ReactNode } from 'react';

import { AdminShell } from '@/components/shell/admin-shell';
import { Button } from '@/components/ui/button';

import { useAdminAuth } from './admin-auth';
import { MfaEnroll } from './mfa-enroll';
import { SignIn } from './sign-in';

/** Solo admin y superadmin, con verificación en dos pasos; el resto ve el ingreso. */
export function AdminGate({ children }: { children: ReactNode }) {
  const { state, user, signOut } = useAdminAuth();
  switch (state) {
    case 'loading':
      return (
        <p role="status" className="grid min-h-dvh place-items-center text-muted-foreground">
          Cargando…
        </p>
      );
    case 'signed_out':
      return <SignIn />;
    case 'enroll':
      return <MfaEnroll />;
    case 'forbidden':
      return (
        <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 text-center">
          <h1 className="text-xl font-semibold">Sin acceso</h1>
          <p className="text-sm text-muted-foreground">
            {user?.email} no tiene permisos de administración.
          </p>
          <Button variant="outline" onClick={() => void signOut()}>
            Usar otra cuenta
          </Button>
        </main>
      );
    case 'ready':
      return <AdminShell>{children}</AdminShell>;
  }
}
