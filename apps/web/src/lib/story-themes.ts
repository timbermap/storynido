import { PawPrint, Rocket, Sparkles, Trophy, type LucideIcon } from 'lucide-react';

/**
 * "¿Qué le encanta?": cuatro temáticas simples para elegir historia sin conocer las colecciones
 * internas. Se resuelven con las etiquetas de cada historia (en español, son claves internas).
 */
export const STORY_THEMES: { key: string; icon: LucideIcon; tags: readonly string[] }[] = [
  { key: 'space', icon: Rocket, tags: ['espacio', 'ciencia', 'planetas', 'inventos'] },
  {
    key: 'animals',
    icon: PawPrint,
    tags: ['dinosaurios', 'animales', 'naturaleza', 'mar', 'mascotas'],
  },
  { key: 'magic', icon: Sparkles, tags: ['magia', 'princesas', 'príncipes', 'fantasía'] },
  { key: 'heroes', icon: Trophy, tags: ['superhéroes', 'deportes', 'fútbol', 'valentía'] },
];

export function matchesTheme(story: { tags: readonly string[] }, key: string): boolean {
  const theme = STORY_THEMES.find((item) => item.key === key);
  return !theme || story.tags.some((tag) => theme.tags.includes(tag));
}

/** Sin tildes ni mayúsculas: "Fútbol" y "futbol" encuentran lo mismo. */
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function matchesSearch(
  story: { title: string; summary: string; tags: readonly string[] },
  query: string,
): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const haystack = normalize([story.title, story.summary, ...story.tags].join(' '));
  return words.every((word) => haystack.includes(word));
}
