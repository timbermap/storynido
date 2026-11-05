/**
 * Armado de cada página por edad (DECISIONS 232): la misma regla para el PDF, la vista previa y los
 * prompts de ilustración, así lo que se ve en la muestra es lo que se imprime.
 *
 * - `facing` (9 años en adelante, mucho texto): página de texto y, enfrente, la ilustración entera.
 *   Cada escena ocupa dos páginas, así que el libro tiene la mitad de ilustraciones con las mismas
 *   páginas (el precio y la imprenta no cambian).
 * - `calm` (hasta 6 años): el texto va directo en la zona calma de la ilustración, sin panel.
 * - `vignette` (7 y 8 años, y cualquier página larga hasta 8 años): la ilustración se funde en el
 *   papel crema arriba o abajo y el texto va ahí, sin taparla.
 * - `overlay`: el panel sobre la ilustración de siempre (libros congelados antes de esto y libros
 *   para colorear).
 */

export type PageLayoutKind = 'facing' | 'calm' | 'vignette' | 'overlay';

/** Mitad de la página que la ilustración deja libre para el texto. */
export type CalmSide = 'top' | 'bottom';

export interface PageLayout {
  kind: PageLayoutKind;
  side: CalmSide;
}

export interface PageLayoutConfig {
  /** Desde esta edad: página de texto e ilustración enfrentadas. */
  facingMinAge: number;
  /** Hasta esta edad: texto directo en la zona calma, sin panel. */
  calmMaxAge: number;
  /** Una página con más palabras que esto va con la ilustración fundida (hasta `facingMinAge`). */
  vignetteMinWords: number;
}

export const DEFAULT_PAGE_LAYOUT: PageLayoutConfig = {
  facingMinAge: 9,
  calmMaxAge: 6,
  vignetteMinWords: 45,
};

/**
 * Armado del libro, que se guarda con la muestra (y el pedido): con `facing`, cada escena es una
 * página de texto y una ilustración. Null en las muestras anteriores (siguen con el panel).
 */
export interface BookLayout {
  facing: boolean;
  /** Edad con la que se decidió (la del protagonista). */
  age: number;
}

export function bookLayout(
  age: number,
  contentType: string,
  config: PageLayoutConfig = DEFAULT_PAGE_LAYOUT,
): BookLayout {
  // Colorear y actividades conservan su armado propio.
  const story = contentType === 'story' || contentType === 'story_activities';
  return { facing: story && age >= config.facingMinAge, age };
}

/**
 * Escenas que escribe e ilustra la IA: con páginas enfrentadas, la mitad (cada escena ocupa dos
 * páginas del libro).
 */
export function scenesFor(narrativePages: number, layout: BookLayout | null | undefined): number {
  return layout?.facing ? Math.max(1, Math.floor(narrativePages / 2)) : narrativePages;
}

/** Páginas del libro que ocupa una escena. */
export const pagesPerScene = (layout: BookLayout | null | undefined) => (layout?.facing ? 2 : 1);

/**
 * Lado calmo que pide el prompt de cada escena: arriba en las impares del plan, abajo en las
 * pares (así las páginas seguidas no son iguales).
 */
export const calmSideFor = (pageIndex: number): CalmSide =>
  pageIndex % 2 === 1 ? 'top' : 'bottom';

export function pageLayout(
  input: {
    layout: BookLayout | null | undefined;
    words: number;
    /** Índice de la escena en el plan (1, 2, ...). */
    pageIndex: number;
    contentType?: string;
  },
  config: PageLayoutConfig = DEFAULT_PAGE_LAYOUT,
): PageLayout {
  const side = calmSideFor(input.pageIndex);
  if (input.contentType === 'coloring') return { kind: 'overlay', side: 'top' };
  if (!input.layout) return { kind: 'overlay', side };
  if (input.layout.facing) return { kind: 'facing', side };
  if (input.words > config.vignetteMinWords || input.layout.age > config.calmMaxAge) {
    return { kind: 'vignette', side };
  }
  return { kind: 'calm', side };
}

/** Lo que el prompt de la ilustración pide según el armado (en inglés, para el modelo). */
export function layoutSceneNote(layout: PageLayout): string {
  const third = layout.side === 'top' ? 'top' : 'bottom';
  switch (layout.kind) {
    case 'facing':
      return ' Full-page illustration with the whole scene: the text goes on the facing page, so no empty area for text is needed. Keep faces away from the edges.';
    case 'vignette':
      return ` Keep the ${third} third of the image as plain warm cream paper (#fffaf3): the illustration fades softly into it with soft, painterly edges and no hard border, and nothing important (no faces, no hands, no key objects) is in that third. The text is printed there.`;
    case 'calm':
      return ` Keep the ${third} third of the image calm and simple (sky, wall, floor or grass, light and with little detail) for the text, with no faces there.`;
    default:
      return layout.side === 'top'
        ? ' Keep the top third of the image calm and simple (sky, wall or soft background) for the text, with no faces there.'
        : ' Keep the bottom third of the image calm and simple (floor, grass or soft background) for the text, with no faces there.';
  }
}
