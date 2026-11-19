import { countWords } from './editorial';

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
 * - `strip` (libros para colorear, DECISIONS 283): el dibujo arriba y, debajo, una franja blanca
 *   con el texto como pie. El texto nunca tapa lo que se pinta.
 * - `overlay`: el panel sobre la ilustración de siempre (libros congelados antes de esto).
 */

export type PageLayoutKind = 'facing' | 'calm' | 'vignette' | 'strip' | 'overlay';

/** Alto del dibujo en una página `strip` (%): el resto es la franja blanca del texto. */
export const STRIP_ART_PCT = 80;

/** Hasta cuántas palabras entra el pie de una página `strip` con la franja normal. */
export const STRIP_CAPTION_WORDS = 14;

/**
 * Alto del dibujo en una página `strip` según el largo del pie (DECISIONS 285): con el texto de
 * siempre (hasta 14 palabras), 80 %; si es más largo (textos viejos o editados a mano), la franja
 * crece para que el texto nunca se salga de la hoja.
 */
export function stripArtPct(text: string | null | undefined): number {
  const words = countWords(text ?? '');
  if (words <= STRIP_CAPTION_WORDS) return STRIP_ART_PCT;
  if (words <= 2 * STRIP_CAPTION_WORDS) return 70;
  return 62;
}

/** Cuánto se achica la letra del pie largo (1 = sin cambio), además de la franja más alta. */
export function stripFontScale(text: string | null | undefined): number {
  const words = countWords(text ?? '');
  if (words <= STRIP_CAPTION_WORDS) return 1;
  return Math.max(0.8, Math.sqrt(STRIP_CAPTION_WORDS / words));
}

/**
 * Palabras que entran en la zona calma (el tercio libre) con la letra de cada edad (DECISIONS 283).
 * Más que esto, la página pasa al papel fundido: antes solo lo hacía con más de 45 palabras y el
 * texto tapaba la ilustración (MAYÚSCULAS de 22-26 pt en 3-4 años).
 */
export function calmMaxWords(age: number): number {
  if (age <= 2) return 12;
  if (age <= 4) return 22;
  return 32;
}

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
  if (input.contentType === 'coloring') return { kind: 'strip', side: 'bottom' };
  if (!input.layout) return { kind: 'overlay', side };
  if (input.layout.facing) return { kind: 'facing', side };
  if (
    input.words > Math.min(config.vignetteMinWords, calmMaxWords(input.layout.age)) ||
    input.layout.age > config.calmMaxAge
  ) {
    return { kind: 'vignette', side };
  }
  return { kind: 'calm', side };
}

/** Lo que el prompt de la ilustración pide según el armado (en inglés, para el modelo). */
export function layoutSceneNote(layout: PageLayout): string {
  const third = layout.side === 'top' ? 'top' : 'bottom';
  const other = layout.side === 'top' ? 'lower' : 'upper';
  switch (layout.kind) {
    case 'strip':
      return ' Full drawing for a coloring page: the text goes in a separate white band below the drawing, so no empty area for text is needed. Keep the main character whole and away from the edges.';
    case 'facing':
      return ' Full-page illustration with the whole scene: the text goes on the facing page, so no empty area for text is needed. Keep faces away from the edges.';
    case 'vignette':
      return ` Keep the ${third} third of the image as plain warm cream paper (#fffaf3): the illustration fades softly into it with soft, painterly edges and no hard border, and nothing important (no faces, no hands, no key objects) is in that third; the main character and the action stay in the ${other} two thirds. The text is printed there.`;
    case 'calm':
      return ` The text is printed over the ${third} third of the image: keep that third calm and simple (sky, wall, floor or grass, light and with little detail), and place the main character whole (head, face, hands and the main action) in the ${other} two thirds, never under the text.`;
    default:
      return layout.side === 'top'
        ? ' The text is printed over the top third: keep it calm and simple (sky, wall or soft background), with the main character, faces and the action in the lower two thirds.'
        : ' The text is printed over the bottom third: keep it calm and simple (floor, grass or soft background), with the main character, faces and the action in the upper two thirds.';
  }
}
