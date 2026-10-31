'use client';

/**
 * Nombre que escribió el visitante en la demo "Escribe su nombre" (solo en su navegador: no se
 * envía a ningún lado). Solo lo usa esa demo: las portadas del catálogo y del asistente muestran siempre el nombre del
 * elenco, porque un nombre escrito podría no corresponder al chico del dibujo.
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
