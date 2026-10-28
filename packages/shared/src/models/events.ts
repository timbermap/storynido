import { z } from 'zod';

/** Tipos de evento (fase 12b): por ahora, cumpleaños. */
export const EVENT_TYPES = ['birthday'] as const;

export const EVENT_LIMITS = { themeMaxLength: 60, maxTurningAge: 15 } as const;

/**
 * Datos del evento de un libro de StoryNido Eventos. Todo opcional mientras es borrador: la
 * fecha sirve para avisar plazos reales (nunca se promete una fecha de entrega).
 */
export const bookEventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  /** Fecha del evento (AAAA-MM-DD). */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  /** Edad que cumple. */
  turningAge: z.number().int().min(1).max(EVENT_LIMITS.maxTurningAge).nullable(),
  /** Temática de la fiesta (dinosaurios, espacio…), moderada antes de usarse. */
  theme: z.string().trim().max(EVENT_LIMITS.themeMaxLength).nullable(),
});

export type BookEvent = z.infer<typeof bookEventSchema>;

export const EMPTY_BIRTHDAY: BookEvent = {
  type: 'birthday',
  date: null,
  turningAge: null,
  theme: null,
};
