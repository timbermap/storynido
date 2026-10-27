import { z } from 'zod';

import { localizedSchema, timestampsSchema } from './common';

/** Líneas comerciales (docs/estrategia/LINEAS-COMERCIALES.md §2). */
export const CHANNELS = ['families', 'events', 'professionals'] as const;

export const channelSchema = z.enum(CHANNELS);

export type Channel = z.infer<typeof channelSchema>;

/** Lo anterior a las líneas comerciales es de Familias. */
export const DEFAULT_CHANNEL: Channel = 'families';

/** Cookie de primera parte con la línea por la que entró la visita (sin datos personales). */
export const CHANNEL_COOKIE = 'sn_channel';

export function parseChannel(value: unknown): Channel | null {
  const parsed = channelSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** collections/{slug}: colección editorial de una línea (editable desde el admin, fase 14). */
export const collectionSchema = timestampsSchema.extend({
  slug: slugSchema,
  active: z.boolean(),
  order: z.number().int(),
  channel: channelSchema,
  name: localizedSchema(z.string().min(1)),
  description: localizedSchema(z.string().min(1)),
  /** Temas u objetivos generales que cubre (en Profesionales, se eligen al crear). */
  topics: z.array(localizedSchema(z.string().min(1))).max(12),
});

export type Collection = z.infer<typeof collectionSchema>;

/** Qué personalización admite una historia (todas por defecto). */
export const personalizationSchema = z.object({
  photo: z.boolean(),
  avatar: z.boolean(),
  memories: z.boolean(),
  lessons: z.boolean(),
});

export type Personalization = z.infer<typeof personalizationSchema>;
