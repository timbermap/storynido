/** El perfil de un personaje deja acá su id para que el primer paso del cuento lo preseleccione. */
export const REUSE_CHARACTER_KEY = 'sn:reuse-character';

/** Lee el id una sola vez (y lo borra), sin romper si el almacenamiento no está disponible. */
export function takeReuseCharacter(): string | null {
  try {
    const id = sessionStorage.getItem(REUSE_CHARACTER_KEY);
    if (id) sessionStorage.removeItem(REUSE_CHARACTER_KEY);
    return id;
  } catch {
    return null;
  }
}

/** Deja el id para que el creador preseleccione a ese personaje («Crear otra aventura»). */
export function saveReuseCharacter(id: string): void {
  try {
    sessionStorage.setItem(REUSE_CHARACTER_KEY, id);
  } catch {
    // Sin almacenamiento, el creador simplemente muestra la lista de personajes.
  }
}
