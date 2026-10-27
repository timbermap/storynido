'use client';

import { useCallback, useEffect, useRef } from 'react';

const PREFIX = 'storynido:draft:';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface Stored<T> {
  at: number;
  values: T;
}

/**
 * Protege lo que se está escribiendo en un paso del creador: se guarda en este dispositivo
 * mientras se escribe y se recupera si la app se cierra antes de "Siguiente" (por ejemplo, al
 * salir a buscar una foto en el celular). Se borra al guardar el paso y vence a los 7 días.
 */
export function useStepDraft<T>(
  bookId: string,
  step: string,
  values: T,
  restore: (saved: T) => void,
): () => void {
  const key = `${PREFIX}${bookId}:${step}`;
  const restored = useRef(false);
  const restoreRef = useRef(restore);

  useEffect(() => {
    restoreRef.current = restore;
  });

  // Se lee después de montar (localStorage no existe en el render del servidor).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      const saved = raw ? (JSON.parse(raw) as Stored<T>) : null;
      if (saved && Date.now() - saved.at < MAX_AGE_MS) restoreRef.current(saved.values);
      else if (saved) window.localStorage.removeItem(key);
    } catch {
      // Sin storage (modo privado): el paso funciona igual, sin recuperación.
    } finally {
      restored.current = true;
    }
  }, [key]);

  useEffect(() => {
    if (!restored.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify({ at: Date.now(), values }));
    } catch {
      // Sin storage: nada que guardar.
    }
  }, [key, values]);

  return useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nada que limpiar.
    }
  }, [key]);
}
