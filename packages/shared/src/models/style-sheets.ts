import type { ContentType } from './editorial';

/**
 * Fichas de ilustración (DECISIONS 282). Una por estilo y una por tipo de libro: se combinan en la
 * dirección de arte en vez de escribir cada combinación. La ficha del estilo manda cuando choca con
 * las reglas generales de la casa (paleta, luz cálida), y trae su propio control automático, que
 * se aplica a cada imagen que devuelve el modelo (antes nada revisaba si respetaba el estilo:
 * el libro «Para colorear» de Lu salió pintado, 19 nov 2026).
 */

/** Control automático de una imagen, medido sobre sus píxeles (ver `colorfulness` en providers). */
export interface ImageCheck {
  /** Tope de color (métrica de Hasler y Süsstrunk; 0 = gris). Colorear: casi cero. */
  maxColorfulness?: number;
  /** Piso de color: un estilo a color que vuelve en blanco y negro o en boceto no pasa. */
  minColorfulness?: number;
  /** Tope de saturación media (0-1): lo «chillón / muy IA» de las tapas de Bebés daba 0,66-0,88. */
  maxSaturation?: number;
  /** Se pasa siempre a blanco y negro (garantía final de los libros para colorear). */
  grayscale?: boolean;
}

export interface StyleSheet {
  /** Técnica: lo único que define cómo se ve cada imagen del libro. */
  medium: string;
  /** Usa la paleta de la historia. Colorear no: no hay color. */
  usesPalette: boolean;
  /** Qué se toma de la foto y de las referencias, y qué no. */
  references: string;
  /** Lo que este estilo nunca hace (se suma al «Avoid» general). */
  avoid: string;
  check: ImageCheck;
}

/**
 * Pisos y topes calibrados con las muestras de cada estilo (apps/web/public/styles): los estilos a
 * color dan 33-60 de color y 0,16-0,58 de saturación; colorear, 0,1 y 0. El test de fichas corre
 * cada muestra contra su propio control.
 */
const COLOR_STYLE_CHECK: ImageCheck = { minColorfulness: 15, maxSaturation: 0.62 };

const COLORING_CHECK: ImageCheck = { maxColorfulness: 15, grayscale: true };

const KEEP_IDENTITY =
  'From the photo and the reference images take only identity (face, hair, skin tone, eyes, glasses, outfit) and, from this book’s own illustrations, the technique.';

export const STYLE_SHEETS: Record<string, StyleSheet> = {
  'cartoon-3d': {
    medium:
      'polished 3D animated feature film look: stylized rounded characters, soft global illumination, gentle subsurface skin, smooth materials and cinematic depth of field (not a flat drawing, not watercolor)',
    usesPalette: true,
    references: KEEP_IDENTITY,
    avoid: 'flat 2D drawing, visible brush strokes, uncanny realistic skin, cheap plastic toys',
    check: { minColorfulness: 15, maxSaturation: 0.7 },
  },
  // Direcciones de ilustración (DECISIONS 141): técnicas humanas y reconocibles, no "IA genérica".
  'lapices-de-colores': {
    medium:
      'hand-drawn colored pencil illustration: imperfect human lines, visible pencil strokes, natural paper grain and deliberately incomplete coloring that lets the paper show through; vary pressure and hatching from page to page',
    usesPalette: true,
    references: KEEP_IDENTITY,
    avoid: 'smooth digital gradients, solid opaque paint, 3D render, uniform vector lines',
    check: COLOR_STYLE_CHECK,
  },
  'cuento-clasico': {
    medium:
      'classic narrative editorial illustration: ink line and opaque paint with moderate texture, believable gestures and storytelling scenography, warm vintage feel',
    usesPalette: true,
    references: KEEP_IDENTITY,
    avoid: '3D render, anime or manga, glossy digital look',
    check: COLOR_STYLE_CHECK,
  },
  'collage-papel': {
    medium:
      'cut-paper collage in the spirit of hand-made picture books: clean cut-out contours, layered sheets of painted and textured paper, visible paper fibers and very subtle shadows between layers; faces keep enough detail to resemble the child',
    usesPalette: true,
    references: KEEP_IDENTITY,
    avoid: 'painted gradients, ink outlines, 3D render',
    check: COLOR_STYLE_CHECK,
  },
  'minimalismo-grafico': {
    medium:
      'contemporary graphic minimalism: expressive silhouettes, simple flat backgrounds, a limited palette of a few colors and a clear composition that reads well even as a small thumbnail; faces stay distinctive and true to the photo',
    usesPalette: true,
    references: KEEP_IDENTITY,
    avoid: 'busy detailed backgrounds, textures everywhere, many colors, 3D render',
    check: COLOR_STYLE_CHECK,
  },
  acuarela: {
    medium:
      'traditional watercolor: transparent washes, soft wet edges, gentle color blooms and visible paper texture; never opaque paint or ink line art',
    usesPalette: true,
    references: KEEP_IDENTITY,
    avoid: 'opaque gouache, thick black ink outlines, flat vector color, 3D render',
    check: COLOR_STYLE_CHECK,
  },
  'para-colorear': {
    medium:
      'black and white coloring book line art: clean closed outlines, no fills, no shading, no gray',
    usesPalette: false,
    references:
      'From the photo and the reference images take only shapes: face shape, hairstyle, glasses and the cut of the clothes. Ignore all their colors and their lighting: colors named for hair, skin or clothes are left white for the child to color.',
    avoid:
      'any color, gray tones, shading, hatching, filled black areas, colored or textured background',
    check: COLORING_CHECK,
  },
  // Para 9-12 (estudio de mercado y mesa, DECISIONS 266): estilo propio en vez de «toques de
  // historieta» mezclados en los demás estilos.
  'novela-grafica': {
    medium:
      'bold contemporary graphic novel art for middle-grade readers: thick confident black ink outlines, spotted solid blacks, flat color fields with hard-edged cel shadows, slightly stylized proportions with expressive eyes and dynamic low or high camera angles; clearly a comic-book look, not a painted storybook; one single full-page image, never panels or speech bubbles',
    usesPalette: true,
    references: KEEP_IDENTITY,
    avoid: 'soft painted storybook look, watercolor, panels or speech bubbles',
    check: { minColorfulness: 15, maxSaturation: 0.7 },
  },
  'gouache-editorial': {
    medium:
      'traditional editorial gouache: matte pigment, irregular brush strokes, opaque layers and a controlled palette; faces slightly angular and individual, never overly round',
    usesPalette: true,
    references: KEEP_IDENTITY,
    avoid: 'glossy digital look, 3D render, transparent watercolor washes',
    check: COLOR_STYLE_CHECK,
  },
};

/** Ficha de un estilo nuevo del admin (sin ficha propia): su técnica es el modificador. */
export function styleSheetFor(input: {
  style?: string | null;
  stylePrompt?: string | null;
  coloring?: boolean;
}): StyleSheet | null {
  if (input.coloring) return STYLE_SHEETS['para-colorear'] ?? null;
  return (input.style ? STYLE_SHEETS[input.style] : undefined) ?? null;
}

/**
 * Control de la imagen: el de la ficha del estilo; para un estilo sin ficha, el de colorear si su
 * técnica es la de colorear (así ningún llamador se olvida) y, si no, solo el tope de saturación.
 */
export function imageCheckFor(input: {
  style?: string | null;
  stylePrompt?: string | null;
  coloring?: boolean;
}): ImageCheck {
  const sheet = styleSheetFor(input);
  if (sheet) return sheet.check;
  if (/coloring (book|page) line art/i.test(input.stylePrompt ?? '')) {
    return COLORING_CHECK;
  }
  // Sin ficha (un estilo nuevo del admin o un pedido sin slug): solo el tope de lo chillón; un
  // estilo nuevo puede ser en blanco y negro a propósito.
  return { maxSaturation: 0.7 };
}

/** Ficha por tipo de libro: cuánto detalle, qué composición y cuánto lugar para el texto. */
export const BOOK_TYPE_SHEETS: Record<ContentType, string> = {
  story:
    'Book type: illustrated story. Each image tells its story beat with a rich but readable scene.',
  story_activities:
    'Book type: illustrated story with activities. Each image tells its story beat with a rich but readable scene; recurring objects stay simple and recognizable because the activities reuse them.',
  activities:
    'Book type: activity book. Simple, clear scenes with few elements, so mazes, spot-the-difference and counting games stay readable.',
  coloring:
    'Book type: coloring book. Few large, well separated shapes with closed outlines and wide white areas a small hand can color; plain or very simple background; no tiny details, no textures, no crowds.',
};

export function bookTypeSheet(contentType: ContentType | null | undefined): string {
  return BOOK_TYPE_SHEETS[contentType ?? 'story'];
}
