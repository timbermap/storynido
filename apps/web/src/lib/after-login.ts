/**
 * «Empezar gratis» sin sesión lleva a ingresar con `?next=` al creador y, después de entrar, al
 * creador (DECISIONS 252). Solo se acepta la portada del creador (`/es/crear`, `/en/create`,
 * `/pt/criar`), nunca un borrador ni otra página: el resto sigue cayendo en la home con sesión.
 */
const CREATOR = /^\/(es|en|pt)\/(crear|create|criar)$/;

const BASE = 'https://storynido.invalid';

/**
 * Creador al que volver: la ruta misma o, si es la página de ingresar guardada para el enlace
 * mágico, su `?next=`. Null si no es la portada del creador.
 */
export function creatorReturn(path: string | null | undefined): string | null {
  if (!path?.startsWith('/') || path.startsWith('//')) return null;
  try {
    const url = new URL(path, BASE);
    if (url.origin !== BASE) return null;
    if (CREATOR.test(url.pathname.replace(/\/$/, ''))) return url.pathname.replace(/\/$/, '');
    const next = url.searchParams.get('next');
    return next && next !== path ? creatorReturn(next) : null;
  } catch {
    return null;
  }
}
