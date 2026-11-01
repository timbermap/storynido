'use client';

import { useSyncExternalStore } from 'react';

/**
 * Nombre que escribió el visitante («¿Cómo se llama?» en el catálogo, la ficha y la demo de la
 * landing). Vive solo en su navegador y no se envía a ningún lado. Las portadas lo muestran en lugar
 * del nombre del elenco; sin nombre, cada portada sigue con el de su personaje.
 */
export const VISITOR_NAME_KEY = 'sn_demo_name';
export const VISITOR_NAME_MAX = 14;
/** Aviso a las portadas de la misma pestaña (el evento `storage` solo llega a las otras). */
const CHANGE_EVENT = 'sn:visitor-name';

export function readVisitorName(): string | null {
  try {
    const value = window.localStorage.getItem(VISITOR_NAME_KEY)?.trim().slice(0, VISITOR_NAME_MAX);
    if (!value) return null;
    return value;
  } catch {
    return null;
  }
}

export function saveVisitorName(name: string): void {
  try {
    const value = name.trim().slice(0, VISITOR_NAME_MAX);
    if (value) window.localStorage.setItem(VISITOR_NAME_KEY, value);
    else window.localStorage.removeItem(VISITOR_NAME_KEY);
  } catch {
    // Sin almacenamiento (ventana privada, bloqueado): el nombre vale solo hasta recargar.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** El nombre escrito (o null); en el servidor y en la primera pintura es null. */
export function useVisitorName(): string | null {
  return useSyncExternalStore(subscribe, readVisitorName, () => null);
}
