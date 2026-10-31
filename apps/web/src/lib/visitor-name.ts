'use client';

import { useEffect, useState } from 'react';

/**
 * Nombre que escribió el visitante en la demo "Escribe su nombre" (solo en su navegador: no se
 * envía a ningún lado). Sin él, las portadas muestran el nombre del elenco de cada historia.
 */
export const VISITOR_NAME_KEY = 'sn_demo_name';
const MAX = 14;

export function readVisitorName(): string | null {
  try {
    const value = window.localStorage.getItem(VISITOR_NAME_KEY)?.trim().slice(0, MAX);
    if (!value) return null;
    return value;
  } catch {
    return null;
  }
}

export function saveVisitorName(name: string): void {
  try {
    const value = name.trim().slice(0, MAX);
    if (value) window.localStorage.setItem(VISITOR_NAME_KEY, value);
    else window.localStorage.removeItem(VISITOR_NAME_KEY);
  } catch {
    // Sin almacenamiento (ventana privada, bloqueado): la demo funciona igual en esta página.
  }
}

/** Nombre a mostrar: primero el elenco (igual en servidor y cliente) y, ya montado, el del visitante. */
export function useVisitorName(fallback: string): string {
  const [name, setName] = useState(fallback);
  useEffect(() => {
    const stored = readVisitorName();
    // Leer localStorage solo es posible después de montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setName(stored);
  }, []);
  return name;
}
