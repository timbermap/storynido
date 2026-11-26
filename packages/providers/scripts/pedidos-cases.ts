/**
 * Los pedidos inventados del golden set (eval-pedidos) y el pedido en palabras para los jueces.
 * Chicos inventados, nunca datos reales. Aparte para que la mesa de jueces (judge-round) los lea sin
 * correr el examen.
 */
import type { BookEvent, CharacterSheet, CharacterTraits, Memories } from '@storynido/shared';

export type Channel = 'families' | 'events' | 'professionals';

export interface PedidoCase {
  id: string;
  /** Qué fallo real cubre (o qué cubre del catálogo). */
  covers: string;
  channel: Channel;
  story: string;
  style: string;
  name: string;
  age: number;
  he?: boolean;
  country: string;
  likes: string[];
  petName?: string;
  bestFriendName?: string;
  memories?: Partial<Memories>;
  event?: Partial<BookEvent>;
  goal?: string;
  /** Profesionales: sonido para practicar (DECISIONS 332). */
  practice?: string;
  sheet: CharacterSheet;
  traits: CharacterTraits;
}

const kid = (
  hair: string,
  skin: string,
  clothing: string,
  age: number,
  traits: Partial<CharacterTraits> = {},
): Pick<PedidoCase, 'sheet' | 'traits'> => ({
  sheet: {
    apparentAge: `about ${String(age)} years old`,
    hair,
    eyes: 'dark brown eyes',
    skinTone: skin,
    distinctiveFeatures: [],
    clothing,
  },
  traits: {
    skinTone: 'tan',
    hairColor: 'dark-brown',
    hairLength: 'short',
    hairType: 'straight',
    eyeColor: 'brown',
    glasses: false,
    distinctive: null,
    ...traits,
  },
});

/** 8 pedidos: los fallos de noviembre y una muestra de cada línea. */
export const CASES: PedidoCase[] = [
  {
    id: 'pro-sonido-3',
    covers:
      'Angélica (25 nov): papá inventado, abrazo no pedido, estribillo reescrito, edad fuera de la plantilla',
    channel: 'professionals',
    story: 'el-sonido-escondido',
    style: 'cuento-clasico',
    name: 'Abril',
    age: 3,
    country: 'AR',
    likes: ['los pájaros'],
    practice: 'la s',
    ...kid('short curly black hair', 'warm brown skin', 'a yellow raincoat and blue leggings', 3, {
      hairType: 'curly',
      hairColor: 'black',
    }),
  },
  {
    id: 'fam-mascota-6',
    covers: 'mascota y mejor amigo del formulario con su nombre; ropa sin letras (remera de Tino)',
    channel: 'families',
    story: 'aventura-espacial',
    style: 'gouache-editorial',
    name: 'Bruno',
    he: true,
    age: 6,
    country: 'MX',
    likes: ['los cohetes', 'su perro'],
    petName: 'Tino',
    bestFriendName: 'Mía',
    ...kid('short straight black hair', 'light brown skin', 'a plain green t-shirt and jeans', 6),
  },
  {
    id: 'fam-mama-5',
    covers: 'familia pedida en los recuerdos: la mamá puede aparecer, nadie más',
    channel: 'families',
    story: 'buenas-noches',
    style: 'lapices-de-colores',
    name: 'Lola',
    age: 5,
    country: 'UY',
    likes: ['las estrellas'],
    memories: { moment: 'Mamá le canta una canción inventada antes de dormir' },
    ...kid('long wavy red hair', 'light skin with freckles', 'pale blue pajamas', 5, {
      hairColor: 'red',
      hairLength: 'long',
      hairType: 'wavy',
      skinTone: 'light',
    }),
  },
  {
    id: 'fam-estribillo-4',
    covers: 'estructura con estribillo en menores de 7: idéntico en varias páginas',
    channel: 'families',
    story: 'aventura-espacial',
    style: 'cuento-clasico',
    name: 'Simón',
    he: true,
    age: 4,
    country: 'AR',
    likes: ['los dinosaurios'],
    ...kid('short straight blond hair', 'light skin', 'red overalls and a white shirt', 4, {
      hairColor: 'blond',
      skinTone: 'light',
    }),
  },
  {
    id: 'diario-11',
    covers: 'Diario: encabezado en cada entrada; personajes que vuelven con nombre (Luli)',
    channel: 'families',
    story: 'el-diario-de-nombre',
    style: 'cuaderno',
    name: 'Vale',
    age: 11,
    country: 'MX',
    likes: ['la guitarra', 'dibujar'],
    ...kid(
      'long straight dark-brown hair in a low ponytail',
      'medium tan skin',
      'a mustard hoodie and dark jeans',
      11,
      { hairLength: 'long' },
    ),
  },
  {
    id: 'manga-12',
    covers: 'Manga que no era manga en páginas y tapa',
    channel: 'families',
    story: 'la-academia-de-dragones',
    style: 'manga',
    name: 'Joaco',
    he: true,
    age: 12,
    country: 'AR',
    likes: ['los dragones', 'el fútbol'],
    ...kid(
      'short curly light-brown hair',
      'light skin',
      'a navy t-shirt and grey cargo trousers',
      12,
      {
        hairType: 'curly',
        hairColor: 'light-brown',
        skinTone: 'light',
      },
    ),
  },
  {
    id: 'eve-cumple-6',
    covers: 'Celebraciones: cumpleaños con temática, invitados sin contacto',
    channel: 'events',
    story: 'el-cumpleanos-mas-magico',
    style: 'gouache-editorial',
    name: 'Martina',
    age: 6,
    country: 'MX',
    likes: ['los dinosaurios'],
    event: { type: 'birthday', turningAge: 6, theme: 'dinosaurios' },
    ...kid('two short black braids', 'warm brown skin', 'an orange party dress', 6, {
      hairColor: 'black',
    }),
  },
  {
    id: 'pro-medico-4',
    covers:
      'Médico y vacuna (25 nov): texto largo de 3-4 años en papel fundido sin tapar caras ni manos; médico sin contacto',
    channel: 'professionals',
    story: 'voy-al-medico-y-me-vacunan',
    style: 'acuarela',
    name: 'Bruno',
    he: true,
    age: 4,
    country: 'AR',
    likes: ['los trenes'],
    goal: 'anticipar una consulta y una vacuna',
    ...kid('short curly light brown hair', 'fair skin', 'a green hoodie and grey pants', 4, {
      hairType: 'curly',
      hairColor: 'light-brown',
    }),
  },
  {
    id: 'pro-dentista-5',
    covers: 'Profesionales: objetivo elegido, sin familia inventada, profesional sin contacto',
    channel: 'professionals',
    story: 'mi-visita-al-dentista',
    style: 'cuento-clasico',
    name: 'Gael',
    he: true,
    age: 5,
    country: 'AR',
    likes: ['los autitos'],
    goal: 'prepararse para la primera visita al dentista',
    ...kid('short straight brown hair', 'olive skin', 'a striped blue sweater and khaki pants', 5),
  },
];

/** El pedido en palabras, como lo llenó el comprador (chicos inventados, nunca datos reales). */
export function orderSummary(testCase: PedidoCase, storyTitle: string, styleName: string): string {
  const line = {
    families: 'Familias (libro personalizado)',
    events: 'Celebraciones (kit de cumpleaños)',
    professionals: 'Profesionales (libro para un paciente)',
  }[testCase.channel];
  return [
    `Línea: ${line}`,
    `Cuento elegido: ${storyTitle}`,
    `Estilo elegido: ${styleName}`,
    `Protagonista: ${testCase.name}, ${String(testCase.age)} años, ${testCase.he ? 'nene' : 'nena'}; ${testCase.sheet.hair}, ${testCase.sheet.skinTone}, ropa de siempre: ${testCase.sheet.clothing}`,
    `Le gusta: ${testCase.likes.join(', ')}`,
    testCase.petName ? `Mascota: ${testCase.petName}` : null,
    testCase.bestFriendName ? `Mejor amigo: ${testCase.bestFriendName}` : null,
    testCase.memories ? `Recuerdos: ${JSON.stringify(testCase.memories)}` : null,
    testCase.event ? `Celebración: ${JSON.stringify(testCase.event)}` : null,
    testCase.goal ? `Objetivo: ${testCase.goal}` : null,
    testCase.practice ? `Sonido para practicar: ${testCase.practice}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}
