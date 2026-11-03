/** Solapas de Mis cuentos, tal como van en `?estado=`. */
export const MY_STORIES_TABS = ['en-creacion', 'en-curso', 'terminados', 'personajes'] as const;

export type MyStoriesTab = (typeof MY_STORIES_TABS)[number];

export function parseMyStoriesTab(value: string | null | undefined): MyStoriesTab | null {
  return MY_STORIES_TABS.find((tab) => tab === value) ?? null;
}

/**
 * Solapa por defecto: lo que está creando, si hay; si no, lo que está en camino; si no, lo
 * terminado.
 */
export function defaultMyStoriesTab(drafts: number, ordersInProgress: number): MyStoriesTab {
  if (drafts > 0) return 'en-creacion';
  if (ordersInProgress > 0) return 'en-curso';
  return 'terminados';
}
