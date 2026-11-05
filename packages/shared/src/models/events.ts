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

type ToneCopy = { name: string; invite: string; waiting: string };
type OccasionTones = Record<InvitationTone, ToneCopy>;

/** Bautismo y comunión: alegre, tierno y emotivo (sin «aventura» en una celebración religiosa). */
const religious = (
  lang: 'es' | 'en' | 'pt',
  what: string,
  /** Portugués: «o meu batizado» / «a minha primeira comunhão» y «no meu…» / «na minha…». */
  pt: { mine: string; inMine: string } = { mine: `o meu ${what}`, inMine: `no meu ${what}` },
): OccasionTones =>
  ({
    es: {
      fun: { name: 'Alegre', invite: `¡Te invito a mi ${what}!`, waiting: '¡Te esperamos!' },
      sweet: {
        name: 'Tierno',
        invite: `Me encantaría que me acompañes en mi ${what}`,
        waiting: 'Te esperamos con cariño',
      },
      adventurous: {
        name: 'Emotivo',
        invite: `Un día muy especial: acompáñame en mi ${what}`,
        waiting: 'Será un día para recordar',
      },
    },
    en: {
      fun: { name: 'Joyful', invite: `You’re invited to my ${what}!`, waiting: 'See you there!' },
      sweet: {
        name: 'Sweet',
        invite: `I’d love you to join me for my ${what}`,
        waiting: 'We can’t wait to see you',
      },
      adventurous: {
        name: 'Heartfelt',
        invite: `A very special day: join me for my ${what}`,
        waiting: 'A day to remember',
      },
    },
    pt: {
      fun: { name: 'Alegre', invite: `Venha para ${pt.mine}!`, waiting: 'Esperamos você!' },
      sweet: {
        name: 'Carinhoso',
        invite: `Eu adoraria que você me acompanhasse ${pt.inMine}`,
        waiting: 'Esperamos você com carinho',
      },
      adventurous: {
        name: 'Emocionante',
        invite: `Um dia muito especial: venha comigo ${pt.inMine}`,
        waiting: 'Vai ser um dia inesquecível',
      },
    },
  })[lang];

/**
 * Textos de la invitación según la ocasión y el tono, en un solo lugar: la muestra del creador y
 * el PDF final dicen lo mismo. Los ids de tono no cambian (fun, sweet, adventurous): con `fun`,
 * los borradores anteriores de cada ocasión quedan con su texto de siempre.
 */
export const INVITATION_TONE_COPY: Record<'es' | 'en' | 'pt', Record<EventType, OccasionTones>> = {
  es: {
    birthday: {
      fun: { name: 'Divertido', invite: '¡Te invito a mi cumple!', waiting: '¡Te esperamos!' },
      sweet: {
        name: 'Tierno',
        invite: 'Me encantaría que vengas a mi cumple',
        waiting: 'Te esperamos con cariño',
      },
      adventurous: {
        name: 'Aventurero',
        invite: '¡Súmate a la aventura de mi cumple!',
        waiting: '¡La aventura empieza contigo!',
      },
    },
    baptism: religious('es', 'bautismo'),
    communion: religious('es', 'primera comunión'),
    graduation: {
      fun: {
        name: 'Divertido',
        invite: '¡Te invito a festejar mi egreso!',
        waiting: '¡Te esperamos!',
      },
      sweet: {
        name: 'Tierno',
        invite: 'Me encantaría que festejes conmigo mi egreso',
        waiting: 'Te esperamos con cariño',
      },
      adventurous: {
        name: 'Aventurero',
        invite: '¡Empieza una nueva aventura: festejemos mi egreso!',
        waiting: '¡La aventura empieza contigo!',
      },
    },
  },
  en: {
    birthday: {
      fun: { name: 'Fun', invite: 'You’re invited to my party!', waiting: 'See you there!' },
      sweet: {
        name: 'Sweet',
        invite: 'I’d love you to come to my party',
        waiting: 'We can’t wait to see you',
      },
      adventurous: {
        name: 'Adventurous',
        invite: 'Join the adventure at my party!',
        waiting: 'The adventure starts with you!',
      },
    },
    baptism: religious('en', 'baptism'),
    communion: religious('en', 'First Communion'),
    graduation: {
      fun: { name: 'Fun', invite: 'Come celebrate my graduation!', waiting: 'See you there!' },
      sweet: {
        name: 'Sweet',
        invite: 'I’d love you to celebrate my graduation with me',
        waiting: 'We can’t wait to see you',
      },
      adventurous: {
        name: 'Adventurous',
        invite: 'A new adventure begins: let’s celebrate my graduation!',
        waiting: 'The adventure starts with you!',
      },
    },
  },
  pt: {
    birthday: {
      fun: {
        name: 'Divertido',
        invite: 'Venha para o meu aniversário!',
        waiting: 'Esperamos você!',
      },
      sweet: {
        name: 'Carinhoso',
        invite: 'Eu adoraria ter você no meu aniversário',
        waiting: 'Esperamos você com carinho',
      },
      adventurous: {
        name: 'Aventureiro',
        invite: 'Entre na aventura do meu aniversário!',
        waiting: 'A aventura começa com você!',
      },
    },
    baptism: religious('pt', 'batizado'),
    communion: religious('pt', 'primeira comunhão', {
      mine: 'a minha primeira comunhão',
      inMine: 'na minha primeira comunhão',
    }),
    graduation: {
      fun: {
        name: 'Divertido',
        invite: 'Venha comemorar a minha formatura!',
        waiting: 'Esperamos você!',
      },
      sweet: {
        name: 'Carinhoso',
        invite: 'Eu adoraria que você comemorasse a minha formatura comigo',
        waiting: 'Esperamos você com carinho',
      },
      adventurous: {
        name: 'Aventureiro',
        invite: 'Uma nova aventura começa: vamos comemorar a minha formatura!',
        waiting: 'A aventura começa com você!',
      },
    },
  },
};

/** Nombre y frases del tono para esa ocasión (sin ocasión: cumpleaños). */
export function invitationCopy(
  language: 'es' | 'en' | 'pt',
  type: EventType | null | undefined,
  tone: InvitationTone | null | undefined,
): ToneCopy {
  return INVITATION_TONE_COPY[language][type ?? 'birthday'][tone ?? 'fun'];
}

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
