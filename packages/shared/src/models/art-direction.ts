import { z } from 'zod';

import type { Channel } from './channels';

/**
 * Dirección de arte de los libros (AUDITORIA-PRODUCTO §3): la marca de la web es suave, pero
 * dentro de los libros los colores son ricos y memorables. Se suma a cada prompt de imagen como
 * bloque fijo (el admin no lo puede quitar): paleta de la historia, criterio por edad y lo que hay
 * que evitar para que no parezca "hecho por IA". Se congela en la muestra y en el pedido: el libro
 * final se ilustra igual que la muestra aprobada.
 */
export const STORY_PALETTES = {
  magic: {
    colors: ['#183F50', '#20A69C', '#F3BE65', '#EF8B91', '#F9EDD9'],
    mood: 'wonder, warmth, gentle fantasy and discovery; golden light against cool forest tones',
  },
  adventure: {
    colors: ['#283C83', '#744DC5', '#17B8C6', '#F5B942', '#F06D55'],
    mood: 'discovery, excitement and invention; deep cosmic blues with bright accents',
  },
  bedtime: {
    colors: ['#536987', '#B5A5D6', '#F4D79D', '#E9B8B8', '#FFF6EB'],
    mood: 'affection, calm and reassurance; soft twilight and moonlight',
  },
  nature: {
    colors: ['#347B63', '#44B9A5', '#E78658', '#F4C857', '#F7E6CA'],
    mood: 'discovery, humor and energy; lush greens with warm sunlit accents',
  },
  celebration: {
    colors: ['#FF6F76', '#FBC84B', '#31BFC4', '#A78BE4', '#FFF0DB'],
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

/** Criterio visual por edad del lector. */
function ageDirection(age: number): string {
  if (age <= 3) {
    return 'For ages 2-3: large characters with clear expressions and strong silhouettes, simple uncluttered backgrounds, soft but visible contrast.';
  }
  if (age <= 5) {
    return 'For ages 4-5: expressive characters, colorful environments, a touch of magic and one clear action per scene.';
  }
  if (age <= 8) {
    return 'For ages 6-8: cinematic composition, detailed worlds, dynamic action and memorable secondary characters.';
  }
  return 'For ages 9-12: dramatic compositions, rich environmental storytelling and expressive characters that do not look babyish.';
}

/** Bloque de dirección de arte para los prompts de imagen. */
export function artDirection(input: {
  age: number;
  channel: Channel;
  palette?: PaletteKey | null;
  /** Libro para colorear: contornos, sin paleta. */
  coloring?: boolean;
}): string {
  const key = input.palette ?? DEFAULT_PALETTE[input.channel];
  const palette = STORY_PALETTES[key];
  const color = input.coloring
    ? 'Black line art only for coloring: clean closed outlines, no fills, no shading.'
    : `Color palette: ${palette.colors.join(', ')} (${palette.mood}); rich, harmonious, never washed-out pastels.`;
  return [
    "Art direction: premium children's picture book, hand-painted digital gouache with subtle watercolor diffusion and natural paper texture, as if one illustrator painted the whole book.",
    color,
    ageDirection(input.age),
    'Purposeful composition that serves the story beat (wide establishing shot, medium action, emotional close-up or character interaction); the main character is the clear focal point.',
    'Avoid: photographic faces, plastic skin, excessive glow or bloom, glossy generic 3D, oversaturated gradients, malformed anatomy, random decorative objects, any text, title, letters or signs in the image, clothing that changes between pages, and any change of style between pages.',
  ].join(' ');
}
