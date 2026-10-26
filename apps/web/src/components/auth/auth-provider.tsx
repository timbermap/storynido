'use client';

import { onIdTokenChanged, type User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { roleFromClaims, type Role } from '@storynido/shared';

import { getFirebase } from '@/lib/firebase/client';
import { ensureUserProfile } from '@/lib/firebase/profile';

interface AuthState {
  user: User | null;
  role: Role;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, role: 'customer', loading: true });

/** Sesión persistente: Firebase la guarda en el navegador y la restaura sola. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, role: 'customer', loading: true });

  useEffect(() => {
    const { auth, db } = getFirebase();
    return onIdTokenChanged(auth, (user) => {
      if (!user) {
        setState({ user: null, role: 'customer', loading: false });
        return;
      }
      void (async () => {
        const token = await user.getIdTokenResult();
        await ensureUserProfile(db, user);
        setState({ user, role: roleFromClaims(token.claims), loading: false });
      })();
    });
  }, []);

  return <AuthContext value={state}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
