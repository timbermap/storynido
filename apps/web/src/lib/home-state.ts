/**
 * Home con sesión: qué línea manda, qué tarjeta va en «Lo próximo» y qué filas lleva «Tus
 * proyectos». Son funciones puras (sin red, storage ni fechas) para poder probarlas: la pantalla
 * les pasa los borradores, los pedidos y las dos pistas que lee aparte (perfil Pro y la línea por
 * la que entró la visita).
 */

import type { ProjectSettings } from '@/lib/firebase/drafts';

export type HomeChannel = 'families' | 'events' | 'professionals';

export const HOME_CHANNELS: readonly HomeChannel[] = ['families', 'events', 'professionals'];

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
  /** Celebraciones: temática de la fiesta (texto que escribió la persona). */
  eventTheme?: string | null;
  /**
   * `draft`: faltan pasos; `generating`: se está dibujando; `character`: el personaje espera que
   * lo aprueben; `preview`: la portada y las primeras páginas (o el kit) están listas.
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
  /** Historia del libro pedido (para no recomendarla de nuevo y para su portada). */
  storyId: string | null;
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

/** Profesionales: un libro dentro de un proyecto (un niño, con su alias). */
export interface HomeProjectBook {
  id: string;
  /** Estado del libro (`draft`, `preview_generating`, `preview_ready`, `ordered`…). */
  status: string;
  storyId: string | null;
  /** Lo que copia «Repetir configuración» (estilo y opciones editoriales). */
  settings?: ProjectSettings;
  updatedAt: number;
}

export interface HomeProject {
  childId: string;
  /** Alias del proyecto; si no tiene, el nombre del cuento. */
  label: string;
  books: HomeProjectBook[];
}

/** Lo que pide una acción ahora: la muestra más cercana a la compra o un pedido en curso. */
export type HomeNext =
  | { kind: 'draft' | 'generating' | 'character' | 'preview'; book: HomeBook }
  | { kind: 'order'; order: HomeOrder; shipped: boolean };

/** Por qué manda una línea (en el orden de las reglas). */
export type HomeLineReason = 'book' | 'order' | 'profile' | 'remembered' | 'last_order' | 'default';

export interface HomeSignals {
  /** Cuenta con el perfil profesional activado. */
  proProfile: boolean;
  /** Línea por la que entró la visita (RememberChannel, en sessionStorage). */
  remembered: HomeChannel | null;
}

export interface HomeView {
  line: HomeChannel;
  reason: HomeLineReason;
  /** Modo profesional: la lista de proyectos va arriba y el botón es «Nuevo proyecto». */
  pro: boolean;
  /** Tarjeta «Lo próximo» (null si no hay nada que pida una acción, y siempre en modo Pro). */
  next: HomeNext | null;
}

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

const time = (item: { updatedAt?: number; createdAt?: number }) =>
  item.updatedAt ?? item.createdAt ?? 0;
const newest = <T extends { updatedAt?: number; createdAt?: number }>(a: T, b: T) =>
  time(b) - time(a);

/** Un pedido digital listo no está «en camino»: ya se puede descargar. */
export function isOpenOrder(order: HomeOrder): boolean {
  if (!IN_PROGRESS.has(order.status)) return false;
  return order.print || order.status !== 'ready';
}

export const isShipped = (order: HomeOrder) => ON_THE_WAY.has(order.status);

/** La muestra sin comprar más cercana a la compra, de cualquier línea (a igual etapa, la más reciente). */
function closestBook(books: readonly HomeBook[]): HomeBook | undefined {
  return [...books].sort((a, b) => BOOK_RANK[b.stage] - BOOK_RANK[a.stage] || newest(a, b))[0];
}

const isHomeChannel = (value: unknown): value is HomeChannel =>
  value === 'families' || value === 'events' || value === 'professionals';

/** La línea guardada por RememberChannel, solo si es una de las tres. */
export const parseRemembered = (value: unknown): HomeChannel | null =>
  isHomeChannel(value) ? value : null;

/**
 * Qué línea manda en la home y si va en modo Pro:
 * 1. la muestra sin comprar más cercana a la compra, de cualquier línea;
 * 2. si no, un pedido en curso;
 * 3. si no, el perfil profesional activado;
 * 4. si no, la línea por la que entró (RememberChannel);
 * 5. si no, la del último pedido; sin nada, Familias.
 * Modo Pro: cuando Profesionales gana por la regla 1 o la 3, o todo lo de la cuenta es profesional.
 */
export function pickHomeLine(
  books: readonly HomeBook[],
  orders: readonly HomeOrder[],
  signals: HomeSignals,
): HomeView {
  const live = orders.filter((order) => BOUGHT.has(order.status));
  const everything = [...books.map((book) => book.channel), ...live.map((order) => order.channel)];
  const onlyPro =
    everything.length > 0 && everything.every((channel) => channel === 'professionals');

  const view = (line: HomeChannel, reason: HomeLineReason, next: HomeNext | null): HomeView => {
    const pro =
      onlyPro || (line === 'professionals' && (reason === 'book' || reason === 'profile'));
    // En modo Pro la lista de proyectos reemplaza a «Lo próximo» (un solo botón: «Nuevo proyecto»).
    return { line, reason, pro, next: pro ? null : next };
  };

  const book = closestBook(books);
  if (book) return view(book.channel, 'book', { kind: book.stage, book });

  const open = live.filter(isOpenOrder).sort(newest)[0];
  if (open)
    return view(open.channel, 'order', { kind: 'order', order: open, shipped: isShipped(open) });

  if (signals.proProfile) return view('professionals', 'profile', null);
  if (signals.remembered) return view(signals.remembered, 'remembered', null);

  const last = [...live].sort(newest)[0];
  if (last) return view(last.channel, 'last_order', null);
  return view('families', 'default', null);
}

/** Filas visibles de «Tus proyectos» en la home; el resto queda en Mis cuentos. */
export const HOME_ROWS = 4;

/**
 * Qué pedidos (por posición, del más reciente al más viejo) necesitan portada: los que pueden
 * llegar a la lista de la home. Los pendientes de pago, cancelados o reembolsados no aparecen, así
 * que no gastan lugar.
 */
export function ordersWithCover(statuses: readonly string[], max = HOME_ROWS): Set<number> {
  const picked = new Set<number>();
  statuses.forEach((status, index) => {
    if (picked.size < max && BOUGHT.has(status)) picked.add(index);
  });
  return picked;
}

/** Una fila de «Tus proyectos». */
export type HomeRow =
  | { kind: 'book'; key: string; line: HomeChannel; book: HomeBook; at: number }
  | { kind: 'order'; key: string; line: HomeChannel; order: HomeOrder; at: number }
  | {
      kind: 'project';
      key: string;
      line: 'professionals';
      project: HomeProject;
      /** El libro más reciente del proyecto (el que se continúa o se repite). */
      book: HomeProjectBook;
      /** Muestra sin comprar del mismo libro, si la hay (portada y personaje). */
      preview: HomeBook | null;
      at: number;
    };

/**
 * Una sola lista de borradores y pedidos de todas las líneas, del más reciente al más viejo. Los
 * libros profesionales se agrupan por niño (una fila por proyecto, con su alias), como en Mis
 * cuentos; los pedidos cancelados o reembolsados no aparecen.
 */
export function buildHomeRows(
  books: readonly HomeBook[],
  orders: readonly HomeOrder[],
  projects: readonly HomeProject[] | null,
): HomeRow[] {
  const inProjects = new Set(projects?.flatMap((project) => project.books.map((b) => b.id)) ?? []);
  const rows: HomeRow[] = [];
  for (const project of projects ?? []) {
    const latest = [...project.books].sort(newest)[0];
    if (!latest) continue;
    rows.push({
      kind: 'project',
      key: `project-${project.childId}`,
      line: 'professionals',
      project,
      book: latest,
      preview: books.find((book) => book.id === latest.id) ?? null,
      at: Math.max(...project.books.map(time)),
    });
  }
  for (const book of books) {
    if (inProjects.has(book.id)) continue;
    rows.push({ kind: 'book', key: `book-${book.id}`, line: book.channel, book, at: time(book) });
  }
  for (const order of orders) {
    if (!BOUGHT.has(order.status) || inProjects.has(order.bookId)) continue;
    rows.push({
      kind: 'order',
      key: `order-${order.id}`,
      line: order.channel,
      order,
      at: time(order),
    });
  }
  return rows.sort((a, b) => b.at - a.at);
}
