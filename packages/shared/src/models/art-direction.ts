import { z } from 'zod';

import type { Channel } from './channels';
import type { ContentType } from './editorial';
import { STYLE_SHEETS, bookTypeSheet, styleSheetFor } from './style-sheets';

/**
 * Dirección de arte de los libros (AUDITORIA-PRODUCTO §3): la marca de la web es suave, pero
 * dentro de los libros los colores son ricos y memorables. Se suma a cada prompt de imagen como
 * bloque fijo (el admin no lo puede quitar): paleta de la historia, criterio por edad y lo que hay
 * que evitar para que no parezca "hecho por IA". Se congela en la muestra y en el pedido: el libro
 * final se ilustra igual que la muestra aprobada.
 */
export const STORY_PALETTES = {
  magic: {
    colors: ['#24404F', '#5E9C8F', '#D9A94F', '#D98A80', '#F5EBDA'],
    mood: 'wonder, warmth, gentle fantasy and discovery; golden light against cool forest tones',
  },
  adventure: {
    colors: ['#2C3A63', '#6B5A94', '#4F98A0', '#D9A548', '#D97B5F'],
    mood: 'discovery, excitement and invention; deep night blues with warm accents',
  },
  bedtime: {
    colors: ['#536987', '#A99CC4', '#E8CF9C', '#DDB3AE', '#FBF3E6'],
    mood: 'affection, calm and reassurance; soft twilight and moonlight',
  },
  nature: {
    colors: ['#3E6E5C', '#7FA88E', '#CF7F5A', '#DDB55A', '#F4E6CC'],
    mood: 'discovery, humor and energy; lush greens with warm sunlit accents',
  },
  celebration: {
    colors: ['#E07F73', '#E3B653', '#5FA6A3', '#9F8CC9', '#FBEFDC'],
    mood: 'joy and celebration; festive energy from the characters, with confetti used sparingly',
  },
  explorer: {
    colors: ['#202D50', '#3A7591', '#6956A6', '#E9AE55', '#F3EBDD'],
    mood: 'curiosity, suspense and independence for older readers; deep night blues with warm lantern light',
  },
  learning: {
    colors: ['#418D89', '#90B9D3', '#EAB39B', '#C1ADDF', '#F8F4EA'],
    mood: 'calm, clarity and confidence; friendly, uncluttered and easy to read',
  },
} as const;

export const PALETTE_KEYS = Object.keys(STORY_PALETTES) as (keyof typeof STORY_PALETTES)[];

export const paletteKeySchema = z.enum(PALETTE_KEYS as [PaletteKey, ...PaletteKey[]]);

export type PaletteKey = keyof typeof STORY_PALETTES;

/** Paleta por defecto según el público, si la historia no tiene una propia. */
export const DEFAULT_PALETTE: Record<Channel, PaletteKey> = {
  families: 'magic',
  events: 'celebration',
  professionals: 'learning',
};

/**
 * Criterio visual por edad del lector (estudio de estilos, DECISIONS 158): la misma familia visual,
 * pero con el contraste, la proporción del personaje y el lenguaje (álbum, historieta, novela
 * gráfica) que corresponden a cada etapa.
 */
export function ageDirection(age: number): string {
  if (age <= 2) {
    // Contraste por valor (oscuro contra claro), no por saturación: los primarios puros y el
    // contorno negro de vector se leían «hechos por IA» (DECISIONS 257).
    return 'For ages 0-2: strong contrast of dark against light (deep navy or warm brown against cream), not of saturated hues; warm, slightly softened colors with one accent per scene, no pure primary red, blue or yellow; very simple shapes, one single element per scene on a calm background, and a large friendly face in the upper half; if the art style uses outlines, they are hand-made in dark warm brown, thin-to-thick, never a uniform black vector outline; avoid washed-out pastels.';
  }
  if (age <= 5) {
    return 'For ages 3-5: rounded proportions (head about a quarter of the body), expressive characters, a limited palette, the child plus one or two elements of the theme and one clear action per scene.';
  }
  if (age <= 8) {
    return 'For ages 6-8: taller proportions (head about a fifth of the body), diagonal dynamic compositions, the child in motion, humor and memorable secondary characters, always in the chosen art style (never comic panels or speech bubbles).';
  }
  // Sin técnica (antes «tinta firme y color plano»): peleaba con el estilo elegido. La técnica la
  // define el estilo; la edad, las proporciones, el encuadre y el tono.
  return 'For ages 9-12: realistic proportions (head about a sixth of the body), cinematic framing, suspense and intrigue; nothing cute or babyish.';
}

/**
 * Técnica según el estilo elegido. Sin esto, el gouache se imponía a todos los estilos y el
 * Cartoon 3D salía pintado a mano (DECISIONS 121). Vive en las fichas de estilo (DECISIONS 282).
 */
const STYLE_MEDIUM: Record<string, string> = Object.fromEntries(
  Object.entries(STYLE_SHEETS).map(([slug, sheet]) => [slug, sheet.medium]),
);

/**
 * Reglas para que no se note que es IA (DECISIONS 141): valen para todos los estilos. El 3D conserva
 * su acabado, pero no sus tics (sonrisas calcadas, brillos).
 */
const HUMAN_CRAFT =
  "Human craft: every face is unique and resembles the reference photo (natural-sized eyes, genuine varied expressions, never identical smiles); texture and brush or line work look intentional, never a uniform filter or noise; no sparkles, halos, lens flares, cinematic gradients or magic glows; keep the character's proportions and palette identical across pages. Clothing: the main character wears exactly the outfit of the reference sheet on every page, and changes it only when the page text explicitly says so or the action is impossible in it (swimming: swimwear; bedtime: pyjamas; rain: a raincoat and boots over the same outfit; cold or snow: a coat over the same outfit; sports: sportswear). Clothes always fit the place, weather and activity: indoors at home, no jackets or outdoor shoes unless arriving or leaving. Never winter clothes on a beach. Recurring objects (a lantern, a backpack, a pet's collar) keep the same shape, size and color on every page, and sports or hobby gear is drawn precisely as named (for example, a squash racket has a small round head and a long thin throat, not a tennis racket).";
/**
 * Ropa en deportes de agua o de riesgo (un cuento de kitesurf salió con jean y zapatillas en el
 * agua). Va aparte de HUMAN_CRAFT para sumarla también a los libros congelados antes.
 */
export const SPORTS_GEAR =
  'Water and risk sports: in the water the characters wear a wetsuit or swimwear, with an impact vest and a helmet when the sport calls for it, barefoot or in booties; never jeans, everyday clothes or shoes in the water. Bikes, skates and boards: helmet.';

const DEFAULT_MEDIUM =
  'hand-painted digital gouache with subtle watercolor diffusion and natural paper texture';

/** Bloque de dirección de arte para los prompts de imagen. */
/**
 * El protagonista aparece una sola vez por imagen. Sin esto, el modelo repetía su ropa y su cara en
 * un niño del fondo y el control de calidad lo mandaba a revisión manual (portada de un pedido
 * profesional).
 */
export const ONE_PROTAGONIST =
  "The main character appears exactly once in each image. Every other child or adult is a different person: different face, hair color and hairstyle, and different clothes; nobody in the background wears the main character's outfit or looks like a twin or clone.";

/**
 * La maquetación pone el texto en la región más calma de cada página: la imagen tiene que dejarle
 * lugar. Sin esto, el panel de texto tapaba caras (informe de Profesionales).
 */
export const TEXT_ZONE =
  'Compose for a printed page with text: the text is printed over one third of the image (the scene says which one, top or bottom); that third is plain, calm background such as sky, wall, floor or grass, and no face, head, hand or key action is ever in it.';

/**
 * Dirección de arte para la lámina del personaje: sin las reglas de composición de página (tercio
 * libre para el texto, plano general, diagonales, encuadre de cine), que achicaban la cara y
 * cambiaban la pose de una lámina que tiene que ser de frente y en calma (DECISIONS 288).
 */
export function characterSheetDirection(direction: string | null | undefined): string | null {
  if (!direction) return direction ?? null;
  return direction
    .replace(TEXT_ZONE, '')
    .replace(
      'Purposeful composition that serves the story beat (wide establishing shot, medium action, emotional close-up or character interaction); the main character is the clear focal point.',
      '',
    )
    .replace('diagonal dynamic compositions, the child in motion, ', '')
    .replace('cinematic framing, ', '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Técnica del estilo elegido; nunca el gouache de la casa si se eligió otro (DECISIONS 265). */
export function mediumFor(input: {
  style?: string | null;
  stylePrompt?: string | null;
  coloring?: boolean;
}): string {
  if (input.coloring) return STYLE_MEDIUM['para-colorear'] ?? DEFAULT_MEDIUM;
  const known = input.style ? STYLE_MEDIUM[input.style] : undefined;
  if (known) return known;
  if (input.stylePrompt?.trim()) return input.stylePrompt.trim();
  return DEFAULT_MEDIUM;
}

/**
 * Candado de estilo (DECISIONS 265): la lámina, la portada, cada página, el elenco y cada
 * «Probar otra ilustración» usan la misma técnica, la que eligió el adulto.
 */
export function styleLock(medium: string): string {
  return `Style lock: the chosen art style is the only technique for every image of this book (character sheet, cover, every page, secondary characters and every redo): ${medium}. Never switch to another technique such as comic-book inking, manga, a sketch, a 3D render or a photo unless that is exactly the chosen style.`;
}

export function artDirection(input: {
  age: number;
  channel: Channel;
  palette?: PaletteKey | null;
  /** Libro para colorear: contornos, sin paleta. */
  coloring?: boolean;
  /** Estilo elegido (slug): define la técnica. */
  style?: string | null;
  /**
   * Modificador del estilo elegido: es la técnica de un estilo que no está en STYLE_MEDIUM (uno
   * nuevo del admin). Antes caía en el gouache de la casa y peleaba con el elegido.
   */
  stylePrompt?: string | null;
  /** Tipo de libro: su ficha dice cuánto detalle y qué composición (DECISIONS 282). */
  contentType?: ContentType | null;
}): string {
  const medium = mediumFor(input);
  const sheet = styleSheetFor(input);
  // La ficha del estilo manda: sin paleta, la edad tampoco habla de colores.
  const colorless = input.coloring === true || sheet?.usesPalette === false;
  const threeD = input.style === 'cartoon-3d';
  const key = input.palette ?? DEFAULT_PALETTE[input.channel];
  const palette = STORY_PALETTES[key];
  const color = colorless
    ? 'Black line art only for coloring: clean closed outlines, no fills, no shading.'
    : `Color palette: ${palette.colors.join(', ')} (${palette.mood}); warm and harmonious, slightly softened: one accent color per scene and the rest earthy and calm; no pure primaries, neon or candy colors, never washed-out pastels.`;
  return [
    `Art direction: premium children's picture book, ${medium}, as if one artist made the whole book.`,
    styleLock(medium),
    color,
    colorless && input.age <= 2
      ? 'For ages 0-2: very simple shapes, one single element per scene on a calm background, and a large friendly face in the upper half.'
      : ageDirection(input.age),
    input.contentType || colorless ? bookTypeSheet(colorless ? 'coloring' : input.contentType) : '',
    sheet ? `${sheet.references} This style never uses: ${sheet.avoid}.` : '',
    HUMAN_CRAFT,
    SPORTS_GEAR,
    threeD ? '' : 'Skin keeps natural variation, never airbrushed or perfectly smooth.',
    'Purposeful composition that serves the story beat (wide establishing shot, medium action, emotional close-up or character interaction); the main character is the clear focal point.',
    ONE_PROTAGONIST,
    TEXT_ZONE,
    `Avoid: photographic faces, ${threeD ? 'uncanny realistic skin, cheap toy-like plastic' : 'plastic skin, glossy generic 3D'}, excessive glow or bloom, oversaturated colors or gradients, glossy highlights in the eyes, perfectly round blush circles, symmetrical doll-like faces, malformed anatomy, random decorative objects, a second copy, twin or look-alike of the main character anywhere in the image, any text, title, letters or signs in the image, clothing that changes between pages when the text does not say so, winter clothes on a beach, and any change of style between pages.`,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Frases viejas de la dirección de arte que imponían una técnica (DECISIONS 265). */
const LEGACY_TECHNIQUE: readonly (readonly [string, string])[] = [
  [
    'hand-made outlines in dark warm brown, thin-to-thick, never a uniform black vector outline;',
    'if the art style uses outlines, they are hand-made in dark warm brown, thin-to-thick, never a uniform black vector outline;',
  ],
  [
    'expressive characters, textured brush work, a limited palette',
    'expressive characters, a limited palette',
  ],
  [
    'humor, comic-book touches such as motion lines and the occasional panel, and memorable secondary characters.',
    'humor and memorable secondary characters, always in the chosen art style (never comic panels or speech bubbles).',
  ],
  [
    'warm and harmonious like printed paint, slightly softened',
    'warm and harmonious, slightly softened',
  ],
];

/**
 * La dirección de arte se congela en la muestra y en el pedido: los libros armados antes de estas
 * reglas no las traen. Se las suma al generar, sin duplicarlas, para que también las usen las
 * regeneraciones y reparaciones de pedidos existentes.
 */
export function withCurrentGuards(direction: string | null | undefined): string | null {
  if (!direction) return null;
  // Las técnicas que la edad o la paleta imponían antes se cambian por las de ahora, para que las
  // muestras y los pedidos anteriores también respeten el estilo elegido (DECISIONS 265).
  for (const [legacy, current] of LEGACY_TECHNIQUE) {
    if (!direction.includes(current)) direction = direction.replace(legacy, current);
  }
  const missing = [ONE_PROTAGONIST, TEXT_ZONE, SPORTS_GEAR].filter(
    (rule) => !direction.includes(rule),
  );
  const medium =
    /premium children's picture book, (.+?), as if one artist made the whole book\./.exec(
      direction,
    )?.[1];
  if (medium && !direction.includes('Style lock:')) missing.unshift(styleLock(medium));
  return missing.length > 0 ? `${direction} ${missing.join(' ')}` : direction;
}
