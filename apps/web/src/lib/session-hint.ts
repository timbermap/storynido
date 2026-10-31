/**
 * Marca de sesión (no es la sesión: solo una pista para la interfaz). El navegador la escribe al
 * entrar con una cuenta real y la borra al salir; el servidor la lee para pintar de entrada el
 * navbar de quien ya es cliente, sin el parpadeo de "Iniciar sesión". La seguridad no depende
 * de ella: los datos siguen protegidos por la sesión de Firebase y la API.
 */
export const SESSION_COOKIE = 'sn_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/** Quita la marca; devuelve si estaba puesta. */
export function hasSessionHint(): boolean {
  return document.cookie.split('; ').some((item) => item === `${SESSION_COOKIE}=1`);
}

export function setSessionHint(on: boolean): void {
  document.cookie = on
    ? `${SESSION_COOKIE}=1; path=/; max-age=${String(SESSION_MAX_AGE)}; samesite=lax`
    : `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
