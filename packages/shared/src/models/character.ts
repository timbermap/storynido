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
