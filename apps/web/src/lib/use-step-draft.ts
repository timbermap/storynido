'use client';

import { useCallback, useEffect, useRef } from 'react';

const PREFIX = 'storynido:draft:';
// Alcanza para salir a buscar una foto y volver; pasado ese rato una creación nueva empieza vacía.
const MAX_AGE_MS = 30 * 60 * 1000;

interface Stored<T> {
  at: number;
  values: T;
}

/**
 * Protege lo que se está escribiendo en un paso del creador: se guarda en este dispositivo
 * mientras se escribe y se recupera si la app se cierra antes de "Siguiente" (por ejemplo, al
 * salir a buscar una foto en el celular). Se borra al guardar el paso y vence a los 30 minutos.
 */
export function useStepDraft<T>(
  bookId: string,
  step: string,
  values: T,
  restore: (saved: T) => void,
): () => void {
  // Un borrador que todavía no se guardó no tiene id: todos compartían la clave
  // «storynido:draft::child» y el amigo, los gustos y la mascota de otro chico (Joaquín: «Renata»)
  // aparecían en el cuento siguiente (Valentina, Celebraciones, 25 nov 2026). Sin id no se guarda.
  const key = bookId ? `${PREFIX}${bookId}:${step}` : null;
  const restored = useRef(false);
  const restoreRef = useRef(restore);

  useEffect(() => {
    restoreRef.current = restore;
  });

  // Se lee después de montar (localStorage no existe en el render del servidor).
  useEffect(() => {
    if (!key) {
      restored.current = true;
      // Lo que quedó guardado con la clave compartida de antes se borra (es de otro chico).
      try {
        window.localStorage.removeItem(`${PREFIX}:${step}`);
      } catch {
        // Sin storage: nada que limpiar.
      }
      return;
    }
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
  }, [key, step]);

  useEffect(() => {
    if (!restored.current || !key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify({ at: Date.now(), values }));
    } catch {
      // Sin storage: nada que guardar.
    }
  }, [key, values]);

  return useCallback(() => {
    try {
      window.localStorage.removeItem(key ?? `${PREFIX}:${step}`);
    } catch {
      // Nada que limpiar.
    }
  }, [key, step]);
}

/** Borra lo guardado en este dispositivo de un borrador (o de todos): al borrarlo en la nube, o al reutilizarlo para algo nuevo. */
export function clearStepDrafts(bookId?: string): void {
  try {
    const prefix = bookId ? `${PREFIX}${bookId}:` : PREFIX;
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(prefix)) window.localStorage.removeItem(key);
    }
  } catch {
    // Sin storage: nada que limpiar.
  }
}

const OWNER_KEY = 'storynido:draft-owner';

/**
 * Lo guardado en este dispositivo es de una sola cuenta: al cerrar sesión o al entrar otra cuenta
 * (una compu de la familia o del consultorio), se borra todo (25 nov 2026: datos de un chico en el
 * cuento de otro). Vincular la sesión anónima conserva el uid y no borra nada.
 */
export function syncStepDraftOwner(uid: string | null): void {
  try {
    const owner = window.localStorage.getItem(OWNER_KEY);
    if (uid === null || (owner !== null && owner !== uid)) clearStepDrafts();
    if (uid === null) window.localStorage.removeItem(OWNER_KEY);
    else window.localStorage.setItem(OWNER_KEY, uid);
  } catch {
    // Sin storage: no hay nada guardado.
  }
}
