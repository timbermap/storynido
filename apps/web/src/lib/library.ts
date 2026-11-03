/**
 * Mis cuentos (la biblioteca): qué va en «Lo próximo», en qué solapa está cada pedido, qué líneas
 * usó la cuenta y qué ideas se le sugieren a un personaje. Funciones puras, como las de la home,
 * para poder probarlas sin red.
 */

import type { BookFormat, OrderStatus } from '@storynido/shared';

import {
  HOME_CHANNELS,
  isShipped,
  type HomeBook,
  type HomeChannel,
  type HomeNext,
  type HomeOrder,
} from '@/lib/home-state';
import { isOrderDone, isOrderInProgress } from '@/lib/order-state';

/** Un pedido con sus ítems (el formato define las acciones del estante). */
export interface LibraryOrder extends HomeOrder {
  items: { format: BookFormat | 'card'; quantity: number }[];
}

/** En qué solapa va un pedido: en curso, terminado o ninguna (cancelado o reembolsado). */
export function orderShelf(order: LibraryOrder): 'inProgress' | 'done' | null {
  const summary = { status: order.status as OrderStatus, items: order.items };
  if (isOrderDone(summary)) return 'done';
  if (isOrderInProgress(summary)) return 'inProgress';
  return null;
}

/** Orden de «Lo próximo»: la muestra lista, el personaje por aprobar y lo que se está dibujando. */
const NEXT_RANK: Partial<Record<HomeBook['stage'], number>> = {
  preview: 3,
  character: 2,
  generating: 1,
};

/**
 * La tarjeta «Lo próximo» (la única con el botón durazno): muestra lista > personaje por aprobar >
 * dibujando > pedido en curso. Un borrador a medias no va: está en «En creación».
 */
export function pickNextUp(
  books: readonly HomeBook[],
  orders: readonly LibraryOrder[],
): HomeNext | null {
  const book = books
    .filter((item) => NEXT_RANK[item.stage] !== undefined)
    .sort(
      (a, b) => (NEXT_RANK[b.stage] ?? 0) - (NEXT_RANK[a.stage] ?? 0) || b.updatedAt - a.updatedAt,
    )[0];
  if (book) return { kind: book.stage, book };
  const order = orders
    .filter((item) => orderShelf(item) === 'inProgress')
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  return order ? { kind: 'order', order, shipped: isShipped(order) } : null;
}

/**
 * Dónde va «Lo próximo» en Mis cuentos: arriba si pide una acción (muestra, personaje, dibujando);
 * un pedido en curso no pide nada, así que baja debajo de las solapas.
 */
export function nextUpPlacement(next: HomeNext): 'top' | 'below' {
  return next.kind === 'order' ? 'below' : 'top';
}

/** Las líneas que usó la cuenta (borradores y pedidos), en el orden de siempre. */
export function linesUsed(
  books: readonly { channel: HomeChannel }[],
  orders: readonly LibraryOrder[],
): HomeChannel[] {
  const used = new Set([
    ...books.map((book) => book.channel),
    ...orders.filter((order) => orderShelf(order) !== null).map((order) => order.channel),
  ]);
  return HOME_CHANNELS.filter((line) => used.has(line));
}

/** Formato del pedido (el primero de sus ítems). */
export const orderFormat = (order: Pick<LibraryOrder, 'items'>) =>
  order.items[0]?.format ?? 'digital';

/** Un pedido solo de tarjetas impresas del kit: no se lee ni se vuelve a pedir desde el estante. */
export const isCardsOrder = (order: Pick<LibraryOrder, 'items'>) =>
  order.items.length > 0 && order.items.every((item) => item.format === 'card');

export type IdeaKind = 'likes' | 'birthday' | 'moment';

export interface Idea {
  kind: IdeaKind;
  /** Lo que más le gusta (solo en la idea «otra aventura»). */
  like?: string;
}

/**
 * Hasta tres ideas para un personaje, con lo que se sabe de verdad: otra aventura con lo que le
 * gusta (si se cargó), su cumpleaños con el kit de Celebraciones (si todavía no tiene uno) y un
 * cuento para un momento (una enseñanza).
 */
export function ideasFor(
  child: { likes: readonly string[] },
  { hasKit }: { hasKit: boolean },
): Idea[] {
  const ideas: Idea[] = [];
  const like = child.likes.find((item) => item.trim() !== '');
  if (like) ideas.push({ kind: 'likes', like: like.trim() });
  if (!hasKit) ideas.push({ kind: 'birthday' });
  ideas.push({ kind: 'moment' });
  return ideas.slice(0, 3);
}
