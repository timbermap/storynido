/**
 * El visor de cuentos (DECISIONS 253): cómo se agrupan las páginas del PDF en pantalla. Funciones
 * puras para poder probarlas sin el navegador.
 */

/**
 * Las páginas que se ven juntas. En una sola página (celular, vertical): una por vez. A doble
 * página (pantalla ancha): la portada sola, después de a dos como un libro abierto (2-3, 4-5…) y
 * la última sola si queda impar.
 */
export function readerSpreads(pageCount: number, spread: boolean): number[][] {
  const pages = Array.from({ length: Math.max(0, pageCount) }, (_, index) => index + 1);
  if (!spread || pageCount < 3) return pages.map((page) => [page]);
  const groups: number[][] = [[1]];
  for (let page = 2; page <= pageCount; page += 2) {
    groups.push(page + 1 <= pageCount ? [page, page + 1] : [page]);
  }
  return groups;
}

/** En qué grupo está una página (para no perder el lugar al girar el celular). */
export function spreadIndexOf(spreads: readonly number[][], page: number): number {
  const found = spreads.findIndex((group) => group.includes(page));
  return found === -1 ? 0 : found;
}

/**
 * Si conviene la doble página: la pantalla tiene que entrar dos páginas a una altura cómoda
 * (al menos el 70 % de la que tendría una sola) y ser de compu o tablet acostada.
 */
export function wantsSpread(box: { width: number; height: number }, pageAspect: number): boolean {
  if (box.width < 700 || box.height <= 0 || pageAspect <= 0) return false;
  const single = Math.min(box.height, box.width / pageAspect);
  const double = Math.min(box.height, box.width / (2 * pageAspect));
  return double >= single * 0.7;
}

/** Alto en px de cada página para que el grupo entre entero en la caja. */
export function fitPageHeight(
  box: { width: number; height: number },
  pageAspect: number,
  perRow: number,
): number {
  if (pageAspect <= 0 || perRow <= 0) return 0;
  return Math.max(0, Math.floor(Math.min(box.height, box.width / (perRow * pageAspect))));
}

const STORAGE_PREFIX = 'sn_reader:';

/** La página donde quedó la lectura de un pedido (en este navegador), o null. */
export function savedPage(orderId: string, pageCount: number): number | null {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_PREFIX + orderId));
    return Number.isInteger(value) && value > 1 && value <= pageCount ? value : null;
  } catch {
    return null;
  }
}

export function savePage(orderId: string, page: number): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + orderId, String(page));
  } catch {
    // Sin storage (ventana privada): se vuelve a empezar desde la portada.
  }
}
