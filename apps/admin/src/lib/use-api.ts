'use client';

import { ApiError } from '@storynido/shared';
import { useCallback, useEffect, useState } from 'react';

/** Carga de una ruta de la API con su estado (datos, error y recarga). */
export function useApi<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await load());
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, [load]);

  useEffect(() => {
    // Lectura de la API después de montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  return { data, setData, error, reload };
}

export const errorMessage = (caught: unknown) =>
  caught instanceof ApiError ? caught.message : 'No pudimos conectar con la API.';
