'use client';

import { isAdminRole, roleFromClaims, type Role } from '@storynido/shared';
import { multiFactor, onIdTokenChanged, signOut, type User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getFirebaseAuth, mfaRequired } from '@/lib/firebase';

/**
 * Estado de acceso al panel:
 * - signed_out: sin sesión.
 * - forbidden: la cuenta no es admin ni superadmin.
 * - enroll: admin sin segundo factor registrado (tiene que configurarlo).
 * - ready: admin con sesión verificada en dos pasos.
 */
export type AccessState = 'loading' | 'signed_out' | 'forbidden' | 'enroll' | 'ready';

interface AdminSession {
  state: AccessState;
  user: User | null;
  role: Role | null;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminSession | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccessState>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    async function update(current: User | null) {
      setUser(current);
      if (!current || current.isAnonymous) {
        setRole(null);
        setState('signed_out');
        return;
      }
      const token = await current.getIdTokenResult();
      const currentRole = roleFromClaims(token.claims);
      setRole(currentRole);
      if (!isAdminRole(currentRole)) {
        setState('forbidden');
      } else if (mfaRequired && multiFactor(current).enrolledFactors.length === 0) {
        setState('enroll');
      } else if (mfaRequired && !token.signInSecondFactor) {
        // Factor registrado pero sesión sin verificar: hay que volver a entrar con el código.
        await signOut(auth);
      } else {
        setState('ready');
      }
    }
    return onIdTokenChanged(auth, (current) => {
      void update(current);
    });
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{ state, user, role, signOut: () => signOut(getFirebaseAuth()) }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminSession {
  const session = useContext(AdminAuthContext);
  if (!session) throw new Error('useAdminAuth fuera de AdminAuthProvider');
  return session;
}
