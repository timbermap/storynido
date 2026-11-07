import type { Locale } from '../i18n';
import type { AgeBand } from './editorial';

/** Letras del cuerpo del cuento (las tres son de licencia libre). */
export const STORY_FONTS = ['quicksand', 'andika', 'fraunces'] as const;
export type StoryFont = (typeof STORY_FONTS)[number];

/**
 * Tipografía del cuento por franja (docs «Cuentos que cuidan»): de 0 a 6, Quicksand Bold (la de la
 * marca, redonda y gruesa); de 7 a 8, Andika («a» y «g» de un piso, la que aprenden); de 9 en
 * adelante, Fraunces como siempre. Tamaños del cuerpo en pt (máximo y mínimo del ajuste).
 */
export const AGE_TYPOGRAPHY: Record<AgeBand, { font: StoryFont; minPt: number; maxPt: number }> = {
  '0-2': { font: 'quicksand', minPt: 30, maxPt: 36 },
  '3-4': { font: 'quicksand', minPt: 22, maxPt: 26 },
  '5-6': { font: 'quicksand', minPt: 18, maxPt: 22 },
  '7-8': { font: 'andika', minPt: 15, maxPt: 17 },
  '9+': { font: 'fraunces', minPt: 13, maxPt: 15 },
};

/** Franjas en MAYÚSCULAS (la imprenta mayúscula es la primera letra que aprenden). */
const UPPERCASE_BANDS: readonly AgeBand[] = ['0-2', '3-4', '5-6'];

export interface StoryTypography {
  font: StoryFont;
  minPt: number;
  maxPt: number;
  /** Solo en español y portugués: en inglés aprenden primero las minúsculas (decidido 05/11). */
  uppercase: boolean;
}

/**
 * La letra y las mayúsculas siguen la edad del lector; el tamaño, la cantidad de texto (si el
 * adulto subió un escalón, la letra es la de esa franja para que el texto entre).
 */
export function storyTypography(
  ageBand: AgeBand,
  textBand: AgeBand,
  language: Locale,
): StoryTypography {
  const size = AGE_TYPOGRAPHY[textBand];
  return {
    font: AGE_TYPOGRAPHY[ageBand].font,
    minPt: size.minPt,
    maxPt: size.maxPt,
    uppercase: UPPERCASE_BANDS.includes(ageBand) && language !== 'en',
  };
}
