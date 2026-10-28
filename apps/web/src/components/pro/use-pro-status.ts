'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';

export type ProStatus = Awaited<ReturnType<typeof api<'proStatus'>>>;

/** Tipo de cuenta y descuento Pro (lo calcula la API; null mientras no hay sesión). */
export function useProStatus() {
  const { user, signedIn } = useAuth();
  const [status, setStatus] = useState<ProStatus | null>(null);

  const refresh = useCallback(async () => {
    setStatus(await api('proStatus'));
  }, []);

  useEffect(() => {
    if (!user || !signedIn) return;
    // Lectura de la API después de montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh().catch(() => {
      // Sin la API no se muestra nada Pro: el resto de la página sigue andando.
    });
  }, [user, signedIn, refresh]);

  return { status: signedIn ? status : null, refresh };
}
