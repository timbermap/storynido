import { z } from 'zod';

/**
 * Ocasiones del kit (fase 12b; DECISIONS 109): cumpleaños, bautismo, primera comunión y egreso
 * o fin de año escolar. La edad que cumple solo aplica al cumpleaños.
 */
export const EVENT_TYPES = ['birthday', 'baptism', 'communion', 'graduation'] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_LIMITS = { themeMaxLength: 60, maxTurningAge: 15, placeMaxLength: 80 } as const;

/** Tono de la invitación. `fun` es el texto de siempre: los borradores anteriores quedan iguales. */
export const INVITATION_TONES = ['fun', 'sweet', 'adventurous'] as const;
export type InvitationTone = (typeof INVITATION_TONES)[number];

/**
 * Qué compra quien organiza la fiesta. El diseño ya incluye el mini cuento y la invitación
 * (DECISIONS 187), así que «solo la invitación» es el diseño sin las demás piezas.
 */
export const KIT_OFFERS = ['full_kit', 'invitation'] as const;
export type KitOffer = (typeof KIT_OFFERS)[number];

/** El libro del cumpleañero, que se compra aparte: lo que eligió en la muestra. */
export const BIRTHDAY_BOOK_CHOICES = ['none', 'digital', 'printed'] as const;
export type BirthdayBookChoice = (typeof BIRTHDAY_BOOK_CHOICES)[number];

/**
 * Textos de la invitación según el tono, en un solo lugar: la muestra del creador y el PDF final
 * dicen lo mismo. Solo cambian las dos frases de cumpleaños; cada ocasión conserva las suyas.
 */
export const INVITATION_TONE_COPY: Record<
  'es' | 'en' | 'pt',
  Record<InvitationTone, { invite: string; waiting: string }>
> = {
  es: {
    fun: { invite: '¡Te invito a mi cumple!', waiting: '¡Te esperamos!' },
    sweet: { invite: 'Me encantaría que vengas a mi cumple', waiting: 'Te esperamos con cariño' },
    adventurous: {
      invite: '¡Súmate a la aventura de mi cumple!',
      waiting: '¡La aventura empieza contigo!',
    },
  },
  en: {
    fun: { invite: 'You’re invited to my party!', waiting: 'See you there!' },
    sweet: { invite: 'I’d love you to come to my party', waiting: 'We can’t wait to see you' },
    adventurous: {
      invite: 'Join the adventure at my party!',
      waiting: 'The adventure starts with you!',
    },
  },
  pt: {
    fun: { invite: 'Venha para o meu aniversário!', waiting: 'Esperamos você!' },
    sweet: {
      invite: 'Eu adoraria ter você no meu aniversário',
      waiting: 'Esperamos você com carinho',
    },
    adventurous: {
      invite: 'Entre na aventura do meu aniversário!',
      waiting: 'A aventura começa com você!',
    },
  },
};

/** La edad que cumple: solo en un cumpleaños y dentro del rango que admite el evento. */
export function turningAgeFor(type: EventType, age: number): number | null {
  return type === 'birthday' && age >= 1 && age <= EVENT_LIMITS.maxTurningAge ? age : null;
}

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
  /** Edad que cumple (solo cumpleaños). */
  turningAge: z.number().int().min(1).max(EVENT_LIMITS.maxTurningAge).nullable(),
  /** Temática de la fiesta (dinosaurios, espacio…), moderada antes de usarse. */
  theme: z.string().trim().max(EVENT_LIMITS.themeMaxLength).nullable(),
  /** Lugar de la fiesta: va en la invitación (se puede cambiar en el pago). */
  place: z.string().trim().max(EVENT_LIMITS.placeMaxLength).nullable().default(null),
  tone: z.enum(INVITATION_TONES).default('fun'),
  /** Los borradores anteriores no lo tienen: el kit completo es lo que promete la landing. */
  offer: z.enum(KIT_OFFERS).default('full_kit'),
  bookChoice: z.enum(BIRTHDAY_BOOK_CHOICES).default('none'),
});

export type BookEvent = z.infer<typeof bookEventSchema>;

export const EMPTY_BIRTHDAY: BookEvent = {
  type: 'birthday',
  date: null,
  turningAge: null,
  theme: null,
  place: null,
  tone: 'fun',
  offer: 'full_kit',
  bookChoice: 'none',
};
