/**
 * Estado de la home con sesión: qué ve cada persona arriba, según lo que ya hizo. Es una función
 * pura (sin red ni fechas) para poder probarla: la pantalla le pasa los borradores y pedidos que
 * ya cargó. Si hay varios cuentos manda el más cercano a la compra; entre dos del mismo tipo, el
 * que se tocó más recientemente.
 */

export type HomeChannel = 'families' | 'events' | 'professionals';

/** Un borrador (o libro con vista previa) sin comprar. */
export interface HomeBook {
  id: string;
  channel: HomeChannel;
  childName: string | null;
  title: string | null;
  coverUrl: string | null;
  /** Historia elegida (su portada de catálogo ilustra el borrador). */
  storyId: string | null;
  /** Dibujo del personaje generado (cuando espera aprobación). */
  characterUrl: string | null;
  totalPages: number | null;
  /**
   * `draft`: faltan pasos; `generating`: se está dibujando; `character`: el personaje espera que
   * lo aprueben; `preview`: la portada y las primeras páginas están listas.
   */
  stage: 'draft' | 'generating' | 'character' | 'preview';
  updatedAt: number;
}

/** Un pedido (pagado). */
export interface HomeOrder {
  id: string;
  bookId: string;
  channel: HomeChannel;
  childName: string | null;
  childId: string | null;
  title: string | null;
  coverUrl: string | null;
  characterUrl: string | null;
  status: string;
  print: boolean;
  createdAt: number;
  /** Ventana estimada de entrega (milisegundos), si el pedido la trae. */
  etaFrom: number | null;
  etaTo: number | null;
}

export type HomeState =
  | { kind: 'new' }
  | { kind: 'draft'; book: HomeBook }
  | { kind: 'generating'; book: HomeBook }
  | { kind: 'character'; book: HomeBook }
  | { kind: 'preview'; book: HomeBook }
  | { kind: 'order'; order: HomeOrder; shipped: boolean }
  | { kind: 'bought'; order: HomeOrder }
  /** Solo proyectos profesionales: el mismo hero, sin hablar de «tu hijo». */
  | { kind: 'pro'; book: HomeBook | null; order: HomeOrder | null };

/** Pedidos que todavía no llegaron a quien compró. */
const IN_PROGRESS = new Set([
  'paid',
  'generating',
  'qa_failed',
  'ready',
  'sent_to_print',
  'in_production',
  'shipped',
]);
/** De esos, los que ya salieron de imprenta. */
const ON_THE_WAY = new Set(['in_production', 'shipped']);
/** Pedidos que cuentan como comprados (no cancelados ni reembolsados). */
const BOUGHT = new Set([...IN_PROGRESS, 'delivered']);

/** Orden de cercanía a la compra de las muestras sin comprar (mayor = más cerca). */
const BOOK_RANK: Record<HomeBook['stage'], number> = {
  preview: 4,
  character: 3,
  generating: 2,
  draft: 1,
};

const newest = <T extends { updatedAt?: number; createdAt?: number }>(a: T, b: T) =>
  (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0);

/** Un pedido digital listo no está «en camino»: ya se puede descargar. */
function isOpen(order: HomeOrder): boolean {
  if (!IN_PROGRESS.has(order.status)) return false;
  return order.print || order.status !== 'ready';
}

export function pickHomeState(books: readonly HomeBook[], orders: readonly HomeOrder[]): HomeState {
  const live = orders.filter((order) => BOUGHT.has(order.status));
  const everything = [...books.map((book) => book.channel), ...live.map((order) => order.channel)];
  const onlyPro =
    everything.length > 0 && everything.every((channel) => channel === 'professionals');
  if (onlyPro) {
    const book = [...books].sort(newest)[0] ?? null;
    const order = [...live].sort(newest)[0] ?? null;
    return { kind: 'pro', book, order };
  }

  // Los proyectos profesionales no compiten con el cuento de una familia.
  const mine = books.filter((book) => book.channel !== 'professionals');
  const best = [...mine].sort((a, b) => BOOK_RANK[b.stage] - BOOK_RANK[a.stage] || newest(a, b))[0];
  if (best) return { kind: best.stage, book: best };

  const mineOrders = live.filter((order) => order.channel !== 'professionals');
  const open = mineOrders.filter(isOpen).sort(newest)[0];
  if (open) return { kind: 'order', order: open, shipped: ON_THE_WAY.has(open.status) };

  const done = [...mineOrders].sort(newest)[0];
  if (done) return { kind: 'bought', order: done };
  return { kind: 'new' };
}

/** Nombre para el título: el del protagonista; sin él, null (el texto cambia a una versión neutra). */
export function heroName(state: HomeState): string | null {
  switch (state.kind) {
    case 'new':
      return null;
    case 'order':
    case 'bought':
      return state.order.childName;
    case 'pro':
      return null;
    default:
      return state.book.childName;
  }
}
