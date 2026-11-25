import { countWords } from './editorial';
import type { StoryTypography } from './typography';

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
  /** Alto (%) de la zona libre para el texto, arriba o abajo (calm / vignette). Por defecto 30. */
  zonePct?: number;
  /** Tamaño de la letra (pt) con el que el texto entra en esa zona, si se conoce la tipografía. */
  fontPt?: number;
}

/**
 * Medida del texto en la página (DECISIONS 300): antes cada edad tenía un tope de palabras, pero la
 * letra en MAYÚSCULAS de 3-6 años es muy ancha y 20 palabras ocupaban casi la mitad de la hoja,
 * encima de la cara. Ahora se estima cuánto alto ocupa el texto y la página elige zona y tamaño.
 */
export const CALM_ZONE_PCT = 30;
/** Zonas altas del papel fundido para los textos largos (la ilustración conserva el resto). */
export const TALL_ZONE_PCT = 40;
export const TALLEST_ZONE_PCT = 45;

/** Ancho de un carácter en «em» (con la separación de las mayúsculas). */
const CHAR_EM: Record<StoryTypography['font'], { upper: number; lower: number }> = {
  quicksand: { upper: 0.74, lower: 0.56 },
  andika: { upper: 0.72, lower: 0.56 },
  fraunces: { upper: 0.7, lower: 0.52 },
};
/** Alto de línea (× tamaño) y proporción de la hoja (alto / ancho). */
const LINE_HEIGHT = 1.375;
const PAGE_ASPECT = 4 / 3;
/** Ancho útil del texto (% del ancho de la hoja) y relleno vertical (% del alto) en la zona. */
const TEXT_WIDTH_PCT = 80;
const TEXT_PAD_PCT = 6;
/** La letra no baja de este factor sobre el mínimo de la edad (la imprenta ya achica un poco). */
const MIN_PT_FACTOR = 0.85;

export type FitTypography = Pick<StoryTypography, 'font' | 'minPt' | 'maxPt' | 'uppercase'>;

/** Alto estimado (% de la hoja) del texto con letra de `pt` puntos. */
export function textHeightPct(
  text: string | null | undefined,
  pt: number,
  typography: FitTypography,
): number {
  const words = (text ?? '').trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return 0;
  const sizePct = pt * 0.25; // % del ancho de la hoja (15,5 pt ≈ 3,9 %)
  const em = CHAR_EM[typography.font][typography.uppercase ? 'upper' : 'lower'];
  const perLine = Math.max(4, Math.floor(TEXT_WIDTH_PCT / (sizePct * em)));
  let lines = 1;
  let used = 0;
  for (const word of words) {
    const len = word.length;
    if (used === 0) used = len;
    else if (used + 1 + len <= perLine) used += 1 + len;
    else {
      lines += 1;
      used = len;
    }
    if (len > perLine) lines += Math.ceil(len / perLine) - 1;
  }
  return ((lines * sizePct * LINE_HEIGHT) / (PAGE_ASPECT * 100)) * 100 + TEXT_PAD_PCT;
}

/** La letra más grande (hasta el máximo de la edad) con la que el texto entra en la zona; null si no entra. */
export function fitTextPt(
  text: string | null | undefined,
  typography: FitTypography,
  zonePct: number,
): number | null {
  const floor = typography.minPt * MIN_PT_FACTOR;
  for (let pt = typography.maxPt; pt >= floor - 1e-6; pt -= 0.5) {
    if (textHeightPct(text, pt, typography) <= zonePct) return pt;
  }
  return null;
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
    /** El texto y la letra de la edad: con ellos la zona y el tamaño salen de medir el texto. */
    text?: string | null;
    typography?: FitTypography | null;
  },
  config: PageLayoutConfig = DEFAULT_PAGE_LAYOUT,
): PageLayout {
  const side = calmSideFor(input.pageIndex);
  if (input.contentType === 'coloring') return { kind: 'strip', side: 'bottom' };
  if (!input.layout) return { kind: 'overlay', side };
  if (input.layout.facing) return { kind: 'facing', side };
  const ty = input.typography;
  if (ty && input.text !== undefined) {
    // Se mide el texto: la zona calma (30 %) si entra con la letra de la edad; si no, el papel
    // fundido; si el texto es largo, la zona alta (40 %) con la letra achicada hasta que entre.
    if (input.layout.age <= config.calmMaxAge) {
      const calm = fitTextPt(input.text, ty, CALM_ZONE_PCT);
      if (calm !== null && input.words <= config.vignetteMinWords) {
        return { kind: 'calm', side, zonePct: CALM_ZONE_PCT, fontPt: calm };
      }
    }
    const short = fitTextPt(input.text, ty, CALM_ZONE_PCT + 2);
    if (short !== null) return { kind: 'vignette', side, zonePct: CALM_ZONE_PCT, fontPt: short };
    const tall = fitTextPt(input.text, ty, TALL_ZONE_PCT);
    if (tall !== null) return { kind: 'vignette', side, zonePct: TALL_ZONE_PCT, fontPt: tall };
    // Ni así entra (el máximo de palabras de la edad con letra mayúscula): zona más alta y letra mínima.
    return {
      kind: 'vignette',
      side,
      zonePct: TALLEST_ZONE_PCT,
      fontPt: fitTextPt(input.text, ty, TALLEST_ZONE_PCT) ?? ty.minPt * MIN_PT_FACTOR,
    };
  }
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
  // Zona reservada: la del texto más un margen, así una cara no roza el borde del texto.
  const zone = String((layout.zonePct ?? CALM_ZONE_PCT) + 5);
  const rest = String(95 - (layout.zonePct ?? CALM_ZONE_PCT));
  switch (layout.kind) {
    case 'strip':
      return ' Full drawing for a coloring page: the text goes in a separate white band below the drawing, so no empty area for text is needed. Keep the main character whole and away from the edges.';
    case 'facing':
      return ' Full-page illustration with the whole scene: the text goes on the facing page, so no empty area for text is needed. Keep faces away from the edges.';
    case 'vignette':
      return ` Keep the ${third} ${zone}% of the image as plain warm cream paper (#fffaf3): the illustration fades softly into it with soft, painterly edges and no hard border, and nothing important (no faces, no heads, no hands, no key objects, no part of the main character) is in that ${zone}%; the main character and the action stay entirely within the ${other} ${rest}%. The text is printed there.`;
    case 'calm':
      return ` The text is printed over the ${third} ${zone}% of the image: keep that part calm and simple (sky, wall, floor or grass, light and with little detail), and place the main character whole (head, face, hands and the main action) entirely within the ${other} ${rest}%, never under the text.`;
    default:
      return layout.side === 'top'
        ? ' The text is printed over the top third: keep it calm and simple (sky, wall or soft background), with the main character, faces and the action in the lower two thirds.'
        : ' The text is printed over the bottom third: keep it calm and simple (floor, grass or soft background), with the main character, faces and the action in the upper two thirds.';
  }
}

/**
 * Zona del texto que el control automático de la imagen vigila (sin cara ni cabeza adentro):
 * solo en las páginas con el texto sobre o dentro de la ilustración. Vacío en el resto.
 */
export function textZoneOf(
  layout: PageLayout | null | undefined,
): { textZone: { side: CalmSide; pct: number } } | Record<string, never> {
  if (!layout || (layout.kind !== 'calm' && layout.kind !== 'vignette')) return {};
  return { textZone: { side: layout.side, pct: layout.zonePct ?? CALM_ZONE_PCT } };
}

/**
 * Ilustraciones del cuento (sin la tapa) para un largo, una edad y un tipo: con texto y dibujo
 * enfrentados cada escena ocupa dos páginas. Así el selector dice «16 páginas · 7 ilustraciones»
 * y nadie espera 16 dibujos (DECISIONS 321). Null para colorear y actividades.
 */
export function storyIllustrations(
  length: { interiorPages: number; fixedPages: number; activityShare: number },
  age: number,
  contentType: string,
  config: PageLayoutConfig = DEFAULT_PAGE_LAYOUT,
): number | null {
  if (contentType !== 'story' && contentType !== 'story_activities') return null;
  const available = length.interiorPages - length.fixedPages;
  const activities =
    contentType === 'story_activities'
      ? Math.max(1, Math.round(available * length.activityShare))
      : 0;
  const narrative = Math.max(2, available - activities);
  return bookLayout(age, contentType, config).facing ? Math.floor(narrative / 2) : narrative;
}
