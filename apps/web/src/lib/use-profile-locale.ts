'use client';

import { useEffect, useState } from 'react';

import type { Locale } from '@storynido/shared';

import { useAuth } from '@/components/auth/auth-provider';

/** Idioma guardado en la cuenta (null mientras carga, sin sesión o si no tiene). */
export function useProfileLocale(): Locale | null {
  const { user, signedIn } = useAuth();
  const [locale, setLocale] = useState<Locale | null>(null);
  useEffect(() => {
    if (!user || !signedIn) return;
    const effect = { cancelled: false };
    void (async () => {
      const [{ getFirebaseDb }, { readProfileLocale }] = await Promise.all([
        import('@/lib/firebase/client'),
        import('@/lib/firebase/profile'),
      ]);
      const saved = await readProfileLocale(await getFirebaseDb(), user.uid).catch(() => null);
      if (!effect.cancelled) setLocale(saved);
    })();
    return () => {
      effect.cancelled = true;
    };
  }, [user, signedIn]);
  return locale;
}
