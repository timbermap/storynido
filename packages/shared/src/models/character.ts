import { z } from 'zod';

import type { CharacterSheet } from '../providers/ai';

/** Cómo se dibuja al protagonista: a partir de su foto o con rasgos elegidos (sin foto). */
export const CHARACTER_MODES = ['photo', 'avatar'] as const;

export const characterModeSchema = z.enum(CHARACTER_MODES);

export type CharacterMode = z.infer<typeof characterModeSchema>;

/** Rasgos del modo sin foto. Mantener sincronizado con firebase/firestore.rules. */
export const AVATAR_OPTIONS = {
  skinTone: ['very-light', 'light', 'medium', 'tan', 'brown', 'deep'],
  hairColor: ['black', 'dark-brown', 'light-brown', 'blond', 'red'],
  hairLength: ['very-short', 'short', 'medium', 'long'],
  hairType: ['straight', 'wavy', 'curly', 'coily'],
  eyeColor: ['brown', 'hazel', 'green', 'blue', 'gray'],
} as const;

export type AvatarTrait = keyof typeof AVATAR_OPTIONS;

export const avatarSchema = z.object({
  skinTone: z.enum(AVATAR_OPTIONS.skinTone),
  hairColor: z.enum(AVATAR_OPTIONS.hairColor),
  hairLength: z.enum(AVATAR_OPTIONS.hairLength),
  hairType: z.enum(AVATAR_OPTIONS.hairType),
  eyeColor: z.enum(AVATAR_OPTIONS.eyeColor),
  glasses: z.boolean(),
});

export type Avatar = z.infer<typeof avatarSchema>;

const SKIN: Record<Avatar['skinTone'], string> = {
  'very-light': 'very fair skin',
  light: 'light skin',
  medium: 'medium olive skin',
  tan: 'tan skin',
  brown: 'brown skin',
  deep: 'deep brown skin',
};

const HAIR_LENGTH: Record<Avatar['hairLength'], string> = {
  'very-short': 'very short',
  short: 'short',
  medium: 'shoulder-length',
  long: 'long',
};

/** Ficha del personaje a partir de los rasgos elegidos (sin foto ni IA). */
export function avatarToSheet(avatar: Avatar, age: number): CharacterSheet {
  return {
    apparentAge: `about ${String(age)} years old`,
    hair: `${HAIR_LENGTH[avatar.hairLength]}, ${avatar.hairType}, ${avatar.hairColor.replace('-', ' ')} hair`,
    eyes: `${avatar.eyeColor} eyes`,
    skinTone: SKIN[avatar.skinTone],
    distinctiveFeatures: avatar.glasses ? ['round glasses'] : [],
    clothing: 'a comfortable colorful t-shirt',
  };
}

/** Clave estable de los rasgos, para saber si la muestra quedó desactualizada. */
export function avatarKey(avatar: Avatar): string {
  return `avatar:${(Object.keys(AVATAR_OPTIONS) as AvatarTrait[]).map((key) => avatar[key]).join('|')}|${String(avatar.glasses)}`;
}

/** Recuerdos guiados: detalles reales de la familia, todos opcionales. */
export const MEMORY_KEYS = ['moment', 'companion', 'nickname', 'favorite'] as const;

export type MemoryKey = (typeof MEMORY_KEYS)[number];

export const MEMORY_MAX_LENGTH = 150;

const memorySchema = z.string().trim().max(MEMORY_MAX_LENGTH).nullable();

export const memoriesSchema = z.object({
  moment: memorySchema,
  companion: memorySchema,
  nickname: memorySchema,
  favorite: memorySchema,
});

export type Memories = z.infer<typeof memoriesSchema>;

export function hasMemories(memories: Memories | null | undefined): memories is Memories {
  return Boolean(memories && MEMORY_KEYS.some((key) => memories[key]));
}

/** Rasgos del protagonista que el adulto confirma o corrige ("¿Es él / es ella?", fase 07d). */
export const characterTraitsSchema = avatarSchema.extend({
  /** Rasgo distintivo libre (pecas, un diente menos…), moderado antes de usarse. */
  distinctive: z.string().trim().max(60).nullable(),
});

export type CharacterTraits = z.infer<typeof characterTraitsSchema>;

/** Rasgos que el adulto marca como obligatorios en todas las ilustraciones. */
export const MUST_KEEP_TRAITS = ['hair', 'skinTone', 'eyeColor', 'glasses', 'distinctive'] as const;

export const mustKeepSchema = z.array(z.enum(MUST_KEEP_TRAITS)).max(MUST_KEEP_TRAITS.length);

export type MustKeepTrait = (typeof MUST_KEEP_TRAITS)[number];

/** Rasgos en una frase para los prompts de imagen, con los obligatorios destacados. */
export function describeTraits(
  traits: CharacterTraits,
  mustKeep: readonly MustKeepTrait[],
): string {
  const sheet = avatarToSheet(traits, 0);
  const parts: Record<MustKeepTrait, string | null> = {
    hair: sheet.hair,
    skinTone: sheet.skinTone,
    eyeColor: sheet.eyes,
    glasses: traits.glasses ? 'wears round glasses' : 'no glasses',
    distinctive: traits.distinctive ? `distinctive feature: ${traits.distinctive}` : null,
  };
  const all = Object.values(parts).filter(Boolean).join('; ');
  const keep = mustKeep.map((trait) => parts[trait]).filter(Boolean);
  return keep.length > 0
    ? `${all}. MUST KEEP IDENTICAL in every illustration: ${keep.join('; ')}`
    : all;
}

/** Clave estable de los rasgos confirmados (desactualiza la muestra si cambian). */
export function traitsKey(traits: CharacterTraits, mustKeep: readonly MustKeepTrait[]): string {
  return `${avatarKey(traits)}|${traits.distinctive ?? ''}|${[...mustKeep].sort().join(',')}`;
}
