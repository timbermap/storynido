import type { Locale } from '@storynido/shared';

import { api } from './api';

/** Pocos por visita: un error repetido en bucle no tiene que inundar el log. */
const MAX_PER_SESSION = 5;
const COUNT_KEY = 'sn_client_errors';

/** Sin datos personales: ni parámetros de búsqueda, ni correos, ni ids largos (pedidos, borradores). */
export function clean(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[correo]')
    .replace(/\?[^\s)"']*/g, '')
    .replace(/\b[A-Za-z0-9_-]{20,}\b/g, ':id');
}

function currentPath(): string {
  return window.location.pathname
    .split('/')
    .map((segment) => (/^[A-Za-z0-9_-]{16,}$/.test(segment) ? ':id' : segment))
    .join('/');
}

/**
 * Manda un error del navegador a nuestro log (no a un tercero). Solo el mensaje, el seguimiento
 * y la ruta, ya limpios; nunca el usuario ni el contenido de la página.
 */
export function reportClientError(error: unknown, source: 'window' | 'promise' | 'boundary'): void {
  try {
    const count = Number(window.sessionStorage.getItem(COUNT_KEY) ?? 0);
    if (count >= MAX_PER_SESSION) return;
    window.sessionStorage.setItem(COUNT_KEY, String(count + 1));
  } catch {
    // Sin storage: se manda igual (el límite por minuto de la API frena los excesos).
  }
  const err = error instanceof Error ? error : new Error(String(error));
  const lang = document.documentElement.lang.slice(0, 2);
  const locale: Locale = lang === 'en' || lang === 'pt' ? lang : 'es';
  void api('clientError', {
    body: {
      message: clean(err.message || err.name).slice(0, 400) || 'Error',
      stack: err.stack ? clean(err.stack).slice(0, 2000) : null,
      path: currentPath().slice(0, 200),
      source,
      locale,
    },
  }).catch(() => undefined);
}
