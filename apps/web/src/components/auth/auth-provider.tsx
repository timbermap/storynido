'use client';

import type { User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { roleFromClaims, type CountryCode, type Locale, type Role } from '@storynido/shared';

import { COUNTRY_COOKIE, COUNTRY_COOKIE_MAX_AGE } from '@/lib/country';

interface AuthState {
  /** Usuario de Firebase, incluida la sesión anónima del creador. */
  user: User | null;
  /** Con cuenta real (no anónima): la que ve "Mi cuenta" y puede comprar. */
  signedIn: boolean;
  role: Role;
  loading: boolean;
}

const LOGGED_OUT: AuthState = { user: null, signedIn: false, role: 'customer', loading: false };

const AuthContext = createContext<AuthState>({ ...LOGGED_OUT, loading: true });

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
  const [state, setState] = useState<AuthState>({ ...LOGGED_OUT, loading: true });

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
          setState(LOGGED_OUT);
          return;
        }
        void (async () => {
          const token = await user.getIdTokenResult();
          setState({
            user,
            signedIn: !user.isAnonymous,
            role: roleFromClaims(token.claims),
            loading: false,
          });
          // La sesión anónima no es una cuenta: el perfil se crea al vincularla.
          if (user.isAnonymous) return;
          const [{ getFirebaseDb }, { ensureUserProfile, readPreferences }, { api }] =
            await Promise.all([
              import('@/lib/firebase/client'),
              import('@/lib/firebase/profile'),
              import('@/lib/api'),
            ]);
          const db = await getFirebaseDb();
          const created = await ensureUserProfile(db, user, { locale, country });
          // Cuenta nueva: la API manda la bienvenida (una sola vez, en el idioma del perfil).
          if (created) {
            await api('me').catch(() => undefined);
            return;
          }
          // Cuenta existente: su país e idioma quedan en este dispositivo (sin recargar).
          const saved = await readPreferences(db, user.uid).catch(() => null);
          const age = String(COUNTRY_COOKIE_MAX_AGE);
          if (saved?.country)
            document.cookie = `${COUNTRY_COOKIE}=${saved.country}; path=/; max-age=${age}; samesite=lax`;
          if (saved?.locale)
            document.cookie = `sn_locale=${saved.locale}; path=/; max-age=${age}; samesite=lax`;
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
