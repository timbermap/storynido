'use client';

import type { User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { roleFromClaims, type CountryCode, type Locale, type Role } from '@storynido/shared';

interface AuthState {
  user: User | null;
  role: Role;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, role: 'customer', loading: true });

/**
 * Sesión persistente: Firebase la guarda en el navegador y la restaura sola.
 * El SDK se carga después de mostrar la página para no frenar la primera carga.
 */
export function AuthProvider({
  children,
  locale,
  country,
}: {
  children: ReactNode;
  locale: Locale;
  country: CountryCode;
}) {
  const [state, setState] = useState<AuthState>({ user: null, role: 'customer', loading: true });

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const effect = { cancelled: false };

    const start = async () => {
      const [{ onIdTokenChanged }, { getFirebaseAuth }] = await Promise.all([
        import('firebase/auth'),
        import('@/lib/firebase/client'),
      ]);
      if (effect.cancelled) return;
      unsubscribe = onIdTokenChanged(getFirebaseAuth(), (user) => {
        if (!user) {
          setState({ user: null, role: 'customer', loading: false });
          return;
        }
        void (async () => {
          const token = await user.getIdTokenResult();
          setState({ user, role: roleFromClaims(token.claims), loading: false });
          const [{ getFirebaseDb }, { ensureUserProfile }] = await Promise.all([
            import('@/lib/firebase/client'),
            import('@/lib/firebase/profile'),
          ]);
          await ensureUserProfile(await getFirebaseDb(), user, { locale, country });
        })();
      });
    };

    // Auth se inicia cuando el navegador queda libre, después de mostrar la página.
    const idle = window.requestIdleCallback(() => void start(), { timeout: 2000 });

    return () => {
      effect.cancelled = true;
      window.cancelIdleCallback(idle);
      unsubscribe?.();
    };
  }, [locale, country]);

  return <AuthContext value={state}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
