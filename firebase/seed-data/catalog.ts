/**
 * Catálogo de ejemplo: 7 aventuras y 4 estilos en los tres idiomas. Las enseñanzas están en lessons.ts.
 * Es el punto de partida; después se edita desde el panel admin (fase 14).
 */
import {
  BOOK_LENGTHS,
  CONTENT_TYPES,
  READING_LEVELS,
  TEXT_DENSITIES,
  type ActivityTemplate,
  type IllustrationStyle,
  type Story,
} from '@storynido/shared';

/** Las portadas con título y su color de tinta son opcionales en el seed (por defecto, la portada tal cual). */
type SeedStory = Omit<Story, 'createdAt' | 'updatedAt' | 'coverTitleOverlay' | 'coverInk'> &
  Partial<Pick<Story, 'coverTitleOverlay' | 'coverInk'>>;
type SeedStyle = Omit<IllustrationStyle, 'createdAt' | 'updatedAt'>;

const TEXT_PROMPT = `Escribe un cuento infantil de {{pageCount}} páginas titulado "{{storyTitle}}".
Protagonista: {{childName}}, {{age}} años (pronombre: {{pronouns}}). Le gusta: {{likes}}.
Mascota: {{petName}}. Mejor amigo o amiga: {{bestFriendName}}.
Enseñanzas para tejer en la trama:
{{lessons}}
Tono cálido y luminoso, un pequeño desafío y un final feliz.
Cada página: su texto y la escena para ilustrar.`;

/** El diente que se cae (ediciones locales, auditoría de historias): la tradición sigue al idioma del libro. */
const TOOTH_PROMPT = `${TEXT_PROMPT}
Tradición del diente según el idioma del libro: en español, el Ratón Pérez (el Ratoncito Pérez) que se lleva el diente de la almohada y deja una moneda; en inglés, la Tooth Fairy (el hada de los dientes); en portugués, a Fada do Dente. Cuenta la costumbre con calidez y sin asustar.`;

/** La Navidad de Lola: en español también puede asomar la noche de Reyes. */
const CHRISTMAS_PROMPT = `${TEXT_PROMPT}
Es una historia de Navidad. En español, puede incluir también la carta a los Reyes Magos y la noche del 5 de enero; en inglés y portugués, Christmas y Natal. Sin marcas ni personajes con derechos de autor.`;

const IMAGE_PROMPT = `Children's picture book illustration: {{scene}}. Main character: {{character}}. Art style: {{style}}. Clear composition, warm light, no text in the image.`;

/** Todas las historias de ejemplo admiten todas las opciones editoriales. */
const EDITORIAL_OPTIONS = {
  lengths: [...BOOK_LENGTHS],
  textDensities: [...TEXT_DENSITIES],
  readingLevels: [...READING_LEVELS],
  contentTypes: [...CONTENT_TYPES],
} satisfies Pick<Story, 'lengths' | 'textDensities' | 'readingLevels' | 'contentTypes'>;

const ALL_PERSONALIZATION = { photo: true, avatar: true, memories: true, lessons: true };

/** Las 7 aventuras originales: colección "Aventuras" de Familias. */
const ADVENTURE = {
  channels: ['families'],
  collectionIds: ['aventuras'],
  personalization: ALL_PERSONALIZATION,
} satisfies Pick<Story, 'channels' | 'collectionIds' | 'personalization'>;

const ADVENTURES: SeedStory[] = [
  {
    slug: 'aventura-espacial',
    suggestedLessons: [
      'valentia',
      'lograr-lo-que-te-propongas',
      'ser-uno-mismo',
      'equivocarse-esta-bien',
    ],
    palette: 'adventure',
    active: true,
    order: 1,
    ageMin: 3,
    ageMax: 5,
    tags: ['espacio', 'aventura'],
    pageCount: 26,
    title: {
      es: 'La gran aventura espacial de [Nombre]',
      en: "[Name]'s Great Space Adventure",
      pt: 'A grande aventura espacial de [Nome]',
    },
    summary: {
      es: 'Un cohete de cartón se convierte en una nave de verdad y lleva a tu peque a visitar planetas, hacer amigos entre las estrellas y volver a casa justo a tiempo para dormir.',
      en: 'A cardboard rocket turns into a real spaceship and takes your little one to visit planets, make friends among the stars, and get home just in time for bed.',
      pt: 'Um foguete de papelão vira uma nave de verdade e leva seu pequeno para visitar planetas, fazer amigos entre as estrelas e voltar para casa bem na hora de dormir.',
    },
    excerpt: {
      es: 'Esa noche, el cohete de cartón empezó a brillar. —¿Listo para despegar? —preguntó una voz desde la ventana. [Nombre] se puso el casco, contó hasta tres… ¡y salieron disparados hacia la Luna!',
      en: 'That night, the cardboard rocket began to glow. "Ready for liftoff?" asked a voice from the window. [Name] put on the helmet, counted to three… and off they zoomed to the Moon!',
      pt: 'Naquela noite, o foguete de papelão começou a brilhar. — Pronto para decolar? — perguntou uma voz na janela. [Nome] colocou o capacete, contou até três… e lá foram eles rumo à Lua!',
    },
    coverImage: '/samples/aventura-espacial.webp',
    samplePages: [],
    textPromptTemplate: TEXT_PROMPT,
    imagePromptTemplate: IMAGE_PROMPT,
    ...EDITORIAL_OPTIONS,
    ...ADVENTURE,
  },
  {
    slug: 'valle-de-los-dinosaurios',
    suggestedLessons: ['cuidar-la-naturaleza', 'valentia', 'amistad', 'respetar-las-diferencias'],
    palette: 'nature',
    active: true,
    order: 2,
    ageMin: 3,
    ageMax: 5,
    tags: ['dinosaurios', 'naturaleza'],
    pageCount: 26,
    title: {
      es: '[Nombre] y el valle de los dinosaurios',
      en: '[Name] and the Dinosaur Valley',
      pt: '[Nome] e o vale dos dinossauros',
    },
    summary: {
      es: 'Detrás del jardín hay un valle secreto donde viven dinosaurios gigantes y muy amables. Tu peque los ayudará a encontrar un huevo perdido antes de que caiga el sol.',
      en: 'Behind the garden lies a secret valley where giant, very friendly dinosaurs live. Your little one will help them find a lost egg before the sun goes down.',
      pt: 'Atrás do jardim existe um vale secreto onde vivem dinossauros gigantes e muito gentis. Seu pequeno vai ajudá-los a encontrar um ovo perdido antes do pôr do sol.',
    },
    excerpt: {
      es: 'El suelo tembló: pum, pum, pum. [Nombre] se escondió detrás de un helecho enorme… ¡y se encontró cara a cara con un triceratops que lloraba porque había perdido su huevo!',
      en: 'The ground shook: boom, boom, boom. [Name] hid behind a giant fern… and came face to face with a triceratops who was crying because she had lost her egg!',
      pt: 'O chão tremeu: bum, bum, bum. [Nome] se escondeu atrás de uma samambaia enorme… e ficou cara a cara com um tricerátopo que chorava porque tinha perdido seu ovo!',
    },
    coverImage: '/samples/valle-de-los-dinosaurios.webp',
    samplePages: [],
    textPromptTemplate: TEXT_PROMPT,
    imagePromptTemplate: IMAGE_PROMPT,
    ...EDITORIAL_OPTIONS,
    ...ADVENTURE,
  },
  {
    slug: 'reino-encantado',
    suggestedLessons: ['ser-uno-mismo', 'decir-la-verdad', 'compartir', 'valentia'],
    palette: 'magic',
    active: true,
    order: 3,
    ageMin: 3,
    ageMax: 5,
    tags: ['princesas', 'príncipes', 'magia'],
    pageCount: 26,
    title: {
      es: '[Nombre] y el reino de los colores',
      en: '[Name] and the Kingdom of Colors',
      pt: '[Nome] e o reino das cores',
    },
    summary: {
      es: 'Un castillo en las nubes necesita a alguien valiente y bondadoso. Tu peque recibe una corona, un mapa mágico y una misión: devolverle los colores al reino.',
      en: 'A castle in the clouds needs someone brave and kind. Your little one receives a crown, a magic map, and a mission: bring the colors back to the kingdom.',
      pt: 'Um castelo nas nuvens precisa de alguém corajoso e bondoso. Seu pequeno recebe uma coroa, um mapa mágico e uma missão: devolver as cores ao reino.',
    },
    excerpt: {
      es: 'En el reino todo se había vuelto gris. —Solo quien tenga un corazón valiente podrá encontrar los colores —dijo la reina. [Nombre] apretó el mapa mágico y dio el primer paso.',
      en: 'Everything in the kingdom had turned gray. "Only someone with a brave heart can find the colors," said the queen. [Name] held the magic map tight and took the first step.',
      pt: 'No reino, tudo tinha ficado cinza. — Só quem tiver um coração corajoso poderá encontrar as cores — disse a rainha. [Nome] segurou firme o mapa mágico e deu o primeiro passo.',
    },
    coverImage: '/samples/reino-encantado.webp',
    samplePages: [],
    textPromptTemplate: TEXT_PROMPT,
    imagePromptTemplate: IMAGE_PROMPT,
    ...EDITORIAL_OPTIONS,
    ...ADVENTURE,
  },
  {
    slug: 'gol-de-campeon',
    suggestedLessons: [
      'amistad',
      'lograr-lo-que-te-propongas',
      'equivocarse-esta-bien',
      'manejar-el-enojo',
    ],
    palette: 'celebration',
    active: true,
    order: 4,
    ageMin: 6,
    ageMax: 8,
    tags: ['fútbol', 'deportes', 'amistad'],
    pageCount: 26,
    title: {
      es: '¡[Nombre], gol de campeón!',
      en: "[Name], Champion's Goal!",
      pt: '[Nome], gol de campeão!',
    },
    summary: {
      es: 'Es la final del torneo del barrio y el equipo necesita a su mejor jugador. Una historia sobre esfuerzo, compañerismo y el gol más importante del año.',
      en: "It's the final of the neighborhood tournament and the team needs its best player. A story about effort, teamwork, and the most important goal of the year.",
      pt: 'É a final do torneio do bairro e o time precisa do seu melhor jogador. Uma história sobre esforço, companheirismo e o gol mais importante do ano.',
    },
    excerpt: {
      es: 'Quedaba un minuto. [Nombre] miró a sus amigos, respiró hondo y corrió con la pelota pegada al pie. La tribuna entera se puso de pie: ¡goooool!',
      en: 'One minute left. [Name] looked at his friends, took a deep breath, and ran with the ball at his feet. The whole crowd jumped up: gooooal!',
      pt: 'Faltava um minuto. [Nome] olhou para os amigos, respirou fundo e correu com a bola colada no pé. A arquibancada inteira se levantou: gooooool!',
    },
    coverImage: '/samples/gol-de-campeon.webp',
    samplePages: [],
    textPromptTemplate: TEXT_PROMPT,
    imagePromptTemplate: IMAGE_PROMPT,
    ...EDITORIAL_OPTIONS,
    ...ADVENTURE,
  },
  {
    slug: 'superheroe-por-un-dia',
    suggestedLessons: [
      'valentia',
      'ser-uno-mismo',
      'decir-la-verdad',
      'calma-cuando-estoy-nervioso',
    ],
    palette: 'adventure',
    active: true,
    order: 5,
    ageMin: 3,
    ageMax: 5,
    tags: ['superhéroes', 'valentía'],
    pageCount: 26,
    title: {
      es: '[Nombre], superhéroe por un día',
      en: '[Name], Superhero for a Day',
      pt: '[Nome], super-herói por um dia',
    },
    summary: {
      es: 'Una capa aparece misteriosamente en la cama de tu peque. Durante un día tendrá superpoderes… y descubrirá que el más grande de todos es ayudar a los demás.',
      en: "A cape mysteriously appears on your little one's bed. For one day they'll have superpowers… and discover that the greatest of all is helping others.",
      pt: 'Uma capa aparece misteriosamente na cama do seu pequeno. Por um dia ele terá superpoderes… e vai descobrir que o maior de todos é ajudar os outros.',
    },
    excerpt: {
      es: 'La capa roja tenía una nota: «Válida por un día». [Nombre] se la ató al cuello y, de pronto, ¡los pies se le despegaron del piso!',
      en: 'The red cape came with a note: "Valid for one day." [Name] tied it around his neck and, suddenly, his feet lifted off the floor!',
      pt: 'A capa vermelha tinha um bilhete: "Válida por um dia". [Nome] amarrou a capa no pescoço e, de repente, os pés saíram do chão!',
    },
    coverImage: '/samples/superheroe-por-un-dia.webp',
    samplePages: [],
    textPromptTemplate: TEXT_PROMPT,
    imagePromptTemplate: IMAGE_PROMPT,
    ...EDITORIAL_OPTIONS,
    ...ADVENTURE,
  },
  {
    slug: 'amigos-de-la-selva',
    suggestedLessons: ['amistad', 'respetar-las-diferencias', 'cuidar-la-naturaleza', 'compartir'],
    palette: 'nature',
    active: true,
    order: 6,
    ageMin: 0,
    ageMax: 2,
    tags: ['animales', 'naturaleza', 'amistad'],
    pageCount: 26,
    title: {
      es: 'Hola, animales: [Nombre] en la selva',
      en: 'Hello, animals: [Name] in the jungle',
      pt: 'Olá, animais: [Nome] na selva',
    },
    summary: {
      es: 'Un libro para decir hola: el tucán, el monito, el jaguar dormilón y [Nombre]. Una frase por página, con repetición para leer en voz alta y señalar con el dedito.',
      en: 'A book for saying hello: the toucan, the little monkey, the sleepy jaguar and [Name]. One line per page, with repetition to read aloud and point at with a little finger.',
      pt: 'Um livro para dizer olá: o tucano, o macaquinho, a onça dorminhoca e [Nome]. Uma frase por página, com repetição para ler em voz alta e apontar com o dedinho.',
    },
    excerpt: {
      es: 'Hola, tucán. Hola, [Nombre]. Hola, monito. Hola, [Nombre]. Shhh, que el jaguar duerme. ¡Chapuzón en el río!',
      en: 'Hello, toucan. Hello, [Name]. Hello, little monkey. Hello, [Name]. Shhh, the jaguar is sleeping. Splash in the river!',
      pt: 'Olá, tucano. Olá, [Nome]. Olá, macaquinho. Olá, [Nome]. Shhh, a onça está dormindo. Splash no rio!',
    },
    coverImage: '/samples/amigos-de-la-selva.webp',
    samplePages: [],
    textPromptTemplate: TEXT_PROMPT,
    imagePromptTemplate: IMAGE_PROMPT,
    ...EDITORIAL_OPTIONS,
    // 0 a 2 años: solo libros cortos y muy visuales (nada de 3.800 palabras para un bebé).
    lengths: ['mini', 'short'],
    textDensities: ['visual'],
    readingLevels: ['beginner'],
    ...ADVENTURE,
  },
  {
    slug: 'secreto-del-fondo-del-mar',
    suggestedLessons: [
      'cuidar-la-naturaleza',
      'valentia',
      'amistad',
      'calma-cuando-estoy-nervioso',
    ],
    palette: 'adventure',
    active: true,
    order: 7,
    ageMin: 3,
    ageMax: 5,
    tags: ['mar', 'aventura', 'naturaleza'],
    pageCount: 26,
    title: {
      es: '[Nombre] y el secreto del fondo del mar',
      en: '[Name] and the Secret of the Deep Sea',
      pt: '[Nome] e o segredo do fundo do mar',
    },
    summary: {
      es: 'Con una burbuja mágica para respirar bajo el agua, tu peque nada entre delfines, tortugas y corales para descubrir un tesoro muy especial.',
      en: 'With a magic bubble to breathe underwater, your little one swims with dolphins, turtles and corals to discover a very special treasure.',
      pt: 'Com uma bolha mágica para respirar debaixo d’água, seu pequeno nada entre golfinhos, tartarugas e corais para descobrir um tesouro muito especial.',
    },
    excerpt: {
      es: 'La burbuja hizo «plop» y, de pronto, [Nombre] podía respirar bajo el agua. Una tortuga muy anciana le guiñó un ojo: —Te estábamos esperando. El tesoro necesita a alguien como tú.',
      en: 'The bubble went "plop" and suddenly [Name] could breathe underwater. A very old turtle winked: "We were waiting for you. The treasure needs someone like you."',
      pt: 'A bolha fez "plop" e, de repente, [Nome] conseguia respirar debaixo d’água. Uma tartaruga bem velhinha piscou: — Estávamos esperando você. O tesouro precisa de alguém como você.',
    },
    coverImage: '/samples/secreto-del-fondo-del-mar.webp',
    samplePages: [],
    textPromptTemplate: TEXT_PROMPT,
    imagePromptTemplate: IMAGE_PROMPT,
    ...EDITORIAL_OPTIONS,
    ...ADVENTURE,
  },
];

/**
 * Cumpleaños por tema (DECISIONS 101): las aventuras de Familias que mejor funcionan en una fiesta
 * se ofrecen también en Eventos, agrupadas en colecciones de cumpleaños (para ellos, para ellas
 * y para todos: superhéroes, ciencia y espacio, fantasía, animales y campeones).
 */
const BIRTHDAY_THEMES: Record<string, string[]> = {
  'superheroe-por-un-dia': ['cumple-superheroes'],
  'aventura-espacial': ['cumple-ciencia-espacio'],
  'valle-de-los-dinosaurios': ['cumple-animales'],
  'amigos-de-la-selva': ['cumple-animales'],
  'secreto-del-fondo-del-mar': ['cumple-animales'],
  'reino-encantado': ['cumple-fantasia'],
  'gol-de-campeon': ['cumple-campeones'],
};

/** Elenco de la marca por historia (rediseño de imágenes, DECISIONS 157). */
export const STORY_CAST: Record<string, string> = {
  'te-quiero-siempre': 'Lola',
  'buenas-noches': 'Lola',
  'amigos-de-la-selva': 'Lola',
  'la-navidad-de-nombre': 'Lola',
  'cuando-naciste': 'Lola',
  'los-mejores-del-mundo': 'Lola',
  'chau-panal': 'Lola',
  'el-volcan-del-enojo': 'Sofi',
  'el-diente-que-se-cayo': 'Sofi',
  'el-club-de-detectives': 'Tomás',
  'dentro-del-videojuego': 'Alex',
  'feliz-cumpleanos': 'Martina',
  'aventura-espacial': 'Tomás',
  'la-gran-carrera': 'Tomás',
  'el-cumpleanos-mas-magico': 'Tomás',
  'valle-de-los-dinosaurios': 'Benja',
  'superheroe-por-un-dia': 'Benja',
  'hermano-mayor': 'Benja',
  'gol-de-campeon': 'Benja',
  'reino-encantado': 'Martina',
  'mi-primer-dia-de-clases': 'Martina',
  'las-tardes-con-los-abuelos': 'Martina',
  'secreto-del-fondo-del-mar': 'Sofi',
  'unicornio-del-arcoiris': 'Sofi',
  'el-misterio-del-faro': 'Alex',
  'un-lunes-al-reves': 'Alex',
};

/** Portadas nuevas con el tercio superior vacío (el título se superpone). Se suman al instalarlas. */
export const NEW_COVER_SLUGS: string[] = [
  'te-quiero-siempre',
  'buenas-noches',
  'amigos-de-la-selva',
  'aventura-espacial',
  'valle-de-los-dinosaurios',
  'reino-encantado',
  'secreto-del-fondo-del-mar',
  'superheroe-por-un-dia',
  'la-gran-carrera',
  'hermano-mayor',
  'la-navidad-de-nombre',
  'cuando-naciste',
  'los-mejores-del-mundo',
  'chau-panal',
  'el-volcan-del-enojo',
  'el-diente-que-se-cayo',
  'el-club-de-detectives',
  'dentro-del-videojuego',
  'feliz-cumpleanos',
  'mi-primer-dia-de-clases',
  'gol-de-campeon',
  'las-tardes-con-los-abuelos',
  'un-lunes-al-reves',
  'el-misterio-del-faro',
  'el-cumpleanos-mas-magico',
  'unicornio-del-arcoiris',
  'las-letras-que-bailan',
  'el-jardin-de-las-emociones',
  'un-pasito-mas',
  'mi-visita-al-dentista',
];

/** Portadas de fondo azul marino: el título va en claro. */
export const LIGHT_INK_SLUGS = [
  'aventura-espacial',
  'buenas-noches',
  'el-misterio-del-faro',
  'la-navidad-de-nombre',
  'chau-panal',
  'dentro-del-videojuego',
];

export const SEED_STORIES: SeedStory[] = ADVENTURES.map((story) => {
  const themes = BIRTHDAY_THEMES[story.slug];
  return themes
    ? {
        ...story,
        channels: [...new Set([...story.channels, 'events' as const])],
        collectionIds: [...story.collectionIds, ...themes],
      }
    : story;
});

/** Historias de las colecciones nuevas (fase 07c), con portada en `/samples/<slug>.webp`. */
const NEW_STORY_BASE = {
  active: true,
  tags: [],
  pageCount: 26,
  samplePages: [],
  textPromptTemplate: TEXT_PROMPT,
  imagePromptTemplate: IMAGE_PROMPT,
  ...EDITORIAL_OPTIONS,
  personalization: ALL_PERSONALIZATION,
};

/** 9 a 12 años: sin formatos ni extensiones de chicos chicos (nada de colorear ni Mini). */
const BIG_READER_BASE = {
  ...NEW_STORY_BASE,
  ageMin: 9,
  ageMax: 12,
  channels: ['families'],
  collectionIds: ['grandes-lectores'],
  lengths: ['short', 'classic', 'epic'],
  textDensities: ['balanced', 'rich'],
  readingLevels: ['developing', 'advanced'],
  contentTypes: ['story', 'story_activities'],
} satisfies Partial<SeedStory>;

/**
 * Historias del estudio de catálogo (DECISIONS 150 y 154), con portada en gouache editorial. Si una
 * se quiere apagar, se hace desde el admin.
 */
const DRAFT_BASE = {
  ...NEW_STORY_BASE,
  active: true,
  channels: ['families'],
} satisfies Partial<SeedStory>;

/** 0 a 3 años: pocas palabras, rima y repetición, para leer en voz alta (solo Mini y Corto). */
const BABY_BASE = {
  ...DRAFT_BASE,
  ageMin: 0,
  ageMax: 2,
  lengths: ['mini', 'short'],
  textDensities: ['visual'],
  readingLevels: ['beginner'],
  contentTypes: ['story'],
} satisfies Partial<SeedStory>;

/**
 * Historias nuevas cuya portada todavía no se generó (`generate-brand-images.ts`): no se siembran
 * hasta tenerla, para no publicar una portada de otro chico. Al generarlas, se vacía esta lista.
 */
export const PENDING_COVER_SLUGS: readonly string[] = [
  'la-navidad-de-nombre',
  'cuando-naciste',
  'los-mejores-del-mundo',
  'chau-panal',
  'el-volcan-del-enojo',
  'el-diente-que-se-cayo',
  'el-club-de-detectives',
  'dentro-del-videojuego',
  'feliz-cumpleanos',
];

const DRAFT_STORIES: SeedStory[] = [
  {
    ...BABY_BASE,
    slug: 'te-quiero-siempre',
    order: 40,
    palette: 'bedtime',
    collectionIds: ['nuestros-recuerdos'],
    suggestedLessons: ['ser-uno-mismo'],
    tags: ['amor', 'vínculo', 'regalo', 'bebés'],
    title: {
      es: 'Te quiero siempre, [Nombre]',
      en: "I'll Love You Always, [Name]",
      pt: 'Te amo sempre, [Nome]',
    },
    summary: {
      es: 'Un libro para decirle todo lo que sientes: te quiero cuando ríes, cuando duermes, cuando creces y cuando eres chiquito. Con su cara de verdad en cada página, el regalo de nacimiento, de primer año o de los abuelos.',
      en: 'A book to tell them everything you feel: I love you when you laugh, when you sleep, when you grow and when you are tiny. With their real face on every page, the gift for a birth, a first birthday or from grandparents.',
      pt: 'Um livro para dizer tudo o que você sente: te amo quando ri, quando dorme, quando cresce e quando é pequeno. Com o rosto de verdade em cada página, o presente de nascimento, de um ano ou dos avós.',
    },
    excerpt: {
      es: 'Te quiero cuando ríes, te quiero cuando duermes. Te quiero chiquito, te quiero cuando creces. [Nombre], te quiero siempre.',
      en: 'I love you when you laugh, I love you when you sleep. I love you little, I love you as you grow. [Name], I love you always.',
      pt: 'Te amo quando ri, te amo quando dorme. Te amo pequeno, te amo quando cresce. [Nome], te amo sempre.',
    },
    coverImage: '/samples/te-quiero-siempre.webp',
  },
  {
    ...BABY_BASE,
    slug: 'buenas-noches',
    order: 41,
    palette: 'bedtime',
    collectionIds: ['grandes-momentos'],
    suggestedLessons: [],
    tags: ['dormir', 'rutina', 'bebés'],
    title: { es: 'Buenas noches, [Nombre]', en: 'Goodnight, [Name]', pt: 'Boa noite, [Nome]' },
    summary: {
      es: 'La rutina de dormir contada con rima: el baño, el pijama, el último abrazo y todas las cosas que también se van a dormir. Para leer en voz baja, todas las noches.',
      en: 'The bedtime routine told in rhyme: the bath, the pajamas, the last hug and all the things that are going to sleep too. To read softly, every night.',
      pt: 'A rotina de dormir contada em rima: o banho, o pijama, o último abraço e todas as coisas que também vão dormir. Para ler em voz baixa, todas as noites.',
    },
    excerpt: {
      es: 'Se duerme el sol, se duerme la luna, se duerme el osito en su cuna. Buenas noches, [Nombre], buenas noches, a dormir.',
      en: 'The sun goes to sleep, the moon goes to sleep, the teddy bear sleeps in its crib. Goodnight, [Name], goodnight, time to sleep.',
      pt: 'O sol vai dormir, a lua vai dormir, o ursinho dorme no berço. Boa noite, [Nome], boa noite, hora de dormir.',
    },
    coverImage: '/samples/buenas-noches.webp',
  },
  {
    ...DRAFT_BASE,
    slug: 'la-gran-carrera',
    order: 42,
    ageMin: 3,
    ageMax: 5,
    palette: 'adventure',
    collectionIds: ['aventuras'],
    suggestedLessons: ['lograr-lo-que-te-propongas', 'equivocarse-esta-bien'],
    tags: ['autos', 'carreras', 'camiones', 'vehículos'],
    title: {
      es: '[Nombre] y la gran carrera',
      en: '[Name] and the Great Race',
      pt: '[Nome] e a grande corrida',
    },
    summary: {
      es: 'Autos, camiones y una pista enorme: tu peque se pone el casco y compite en la carrera más divertida del barrio, con curvas, charcos y un amigo que necesita ayuda.',
      en: 'Cars, trucks and an enormous track: your little one puts on a helmet and races in the most fun race in the neighborhood, with curves, puddles and a friend who needs help.',
      pt: 'Carros, caminhões e uma pista enorme: seu pequeno coloca o capacete e compete na corrida mais divertida do bairro, com curvas, poças e um amigo que precisa de ajuda.',
    },
    excerpt: {
      es: '¡Brum, brum! [Nombre] se puso el casco y apretó el volante. La bandera verde bajó y la gran carrera empezó.',
      en: 'Vroom, vroom! [Name] put on the helmet and gripped the wheel. The green flag dropped and the great race began.',
      pt: 'Vrum, vrum! [Nome] colocou o capacete e apertou o volante. A bandeira verde baixou e a grande corrida começou.',
    },
    coverImage: '/samples/la-gran-carrera.webp',
  },
  {
    ...DRAFT_BASE,
    slug: 'hermano-mayor',
    order: 43,
    ageMin: 3,
    ageMax: 5,
    palette: 'magic',
    collectionIds: ['grandes-momentos'],
    suggestedLessons: ['llega-un-hermanito', 'compartir'],
    tags: ['hermanito', 'familia', 'hitos'],
    title: {
      es: '[Nombre], hermano mayor',
      en: '[Name], Big Brother',
      pt: '[Nome], irmão mais velho',
    },
    summary: {
      es: 'Llega un bebé a casa y [Nombre] descubre lo que significa ser el mayor: mostrar, ayudar, esperar y, sobre todo, ser único para siempre. Sirve igual para hermana mayor.',
      en: 'A baby comes home and [Name] discovers what being the oldest means: showing, helping, waiting and, above all, being one of a kind forever. It works just as well for a big sister.',
      pt: 'Chega um bebê em casa e [Nome] descobre o que significa ser o mais velho: mostrar, ajudar, esperar e, acima de tudo, ser único para sempre. Serve igual para irmã mais velha.',
    },
    excerpt: {
      es: 'El bebé lloró y [Nombre] pensó: «¿Y ahora qué hago?». Entonces le ofreció su osito y el bebé, por fin, sonrió.',
      en: 'The baby cried and [Name] thought: "Now what do I do?" So [Name] offered the teddy bear and the baby, at last, smiled.',
      pt: 'O bebê chorou e [Nome] pensou: «E agora, o que eu faço?». Então ofereceu o ursinho e o bebê, finalmente, sorriu.',
    },
    coverImage: '/samples/hermano-mayor.webp',
  },
  {
    ...BABY_BASE,
    // Publicada para la temporada (auditoría de historias): la edición de Reyes es el mismo cuento en español.
    textPromptTemplate: CHRISTMAS_PROMPT,
    slug: 'la-navidad-de-nombre',
    order: 44,
    ageMin: 1,
    ageMax: 4,
    palette: 'celebration',
    collectionIds: ['grandes-momentos'],
    suggestedLessons: ['compartir', 'amistad'],
    tags: ['navidad', 'reyes', 'temporada', 'regalo'],
    title: {
      es: 'La Navidad de [Nombre]',
      en: "[Name]'s Christmas",
      pt: 'O Natal de [Nome]',
    },
    summary: {
      es: 'La noche más esperada del año, con [Nombre] como protagonista: las luces, el árbol, una carta que viaja lejos y un regalo que no se compra. En España, también para la noche de Reyes.',
      en: 'The most awaited night of the year, starring [Name]: the lights, the tree, a letter that travels far and a gift that cannot be bought. In Spain, also for Three Kings night.',
      pt: 'A noite mais esperada do ano, com [Nome] como protagonista: as luzes, a árvore, uma carta que viaja longe e um presente que não se compra. Na Espanha, também para a noite de Reis.',
    },
    excerpt: {
      es: 'Esa noche, las luces del árbol parpadearon tres veces. [Nombre] abrió un ojo y escuchó: alguien golpeaba la ventana, despacito, tic, tic, tic.',
      en: 'That night, the tree lights blinked three times. [Name] opened one eye and listened: someone was knocking on the window, softly, tap, tap, tap.',
      pt: 'Naquela noite, as luzes da árvore piscaram três vezes. [Nome] abriu um olho e escutou: alguém batia na janela, devagarinho, toc, toc, toc.',
    },
    coverImage: '/samples/la-navidad-de-nombre.webp',
  },
  {
    // Solo Celebraciones: la temática de unicornios y arcoíris no tiene versión de Familias.
    ...DRAFT_BASE,
    slug: 'unicornio-del-arcoiris',
    order: 45,
    ageMin: 3,
    ageMax: 5,
    channels: ['events'],
    palette: 'celebration',
    collectionIds: ['cumple-fantasia'],
    suggestedLessons: ['amistad'],
    tags: ['unicornios', 'arcoíris', 'fantasía', 'cumpleaños'],
    title: {
      es: '[Nombre] y el unicornio del arcoíris',
      en: '[Name] and the Rainbow Unicorn',
      pt: '[Nome] e o unicórnio do arco-íris',
    },
    summary: {
      es: 'Un unicornio pierde los colores de su arcoíris justo el día de la fiesta, y [Nombre] y sus invitados salen a buscarlos. La temática de unicornios, con todo el kit.',
      en: 'A unicorn loses the colors of its rainbow on the day of the party, and [Name] and the guests set out to find them. The unicorn theme, with the whole kit.',
      pt: 'Um unicórnio perde as cores do seu arco-íris justo no dia da festa, e [Nome] e os convidados saem para procurá-las. A temática de unicórnios, com todo o kit.',
    },
    excerpt: {
      es: 'El unicornio llegó a la fiesta con el arcoíris descolorido. «¡Nos faltan los colores!», dijo [Nombre], y todos corrieron a buscarlos.',
      en: 'The unicorn arrived at the party with a faded rainbow. "We are missing the colors!" said [Name], and everyone ran to find them.',
      pt: 'O unicórnio chegou à festa com o arco-íris desbotado. «Faltam as cores!», disse [Nome], e todos correram para buscá-las.',
    },
    coverImage: '/samples/unicornio-del-arcoiris.webp',
  },
  {
    ...BABY_BASE,
    slug: 'cuando-naciste',
    order: 46,
    palette: 'bedtime',
    collectionIds: ['grandes-momentos'],
    suggestedLessons: [],
    tags: ['nacimiento', 'bebés', 'regalo', 'familia'],
    title: {
      es: 'Cuando naciste, [Nombre]',
      en: 'The Day You Were Born, [Name]',
      pt: 'Quando você nasceu, [Nome]',
    },
    summary: {
      es: 'El libro de bienvenida: cómo lo esperábamos, el día en que llegó y todo lo que cambió en casa. El regalo de nacimiento para leer en voz baja, con su cara de verdad en cada página.',
      en: 'The welcome book: how we waited for you, the day you arrived and everything that changed at home. The birth gift to read softly, with their real face on every page.',
      pt: 'O livro de boas-vindas: como esperávamos por você, o dia em que chegou e tudo o que mudou em casa. O presente de nascimento para ler em voz baixa, com o rosto de verdade em cada página.',
    },
    excerpt: {
      es: 'Te esperábamos, [Nombre]. Y un día llegaste: chiquita, chiquita, con los ojos bien abiertos. Hola, [Nombre]. Ya estás en casa.',
      en: 'We were waiting for you, [Name]. And one day you arrived: tiny, tiny, with your eyes wide open. Hello, [Name]. You are home.',
      pt: 'Esperávamos por você, [Nome]. E um dia você chegou: pequenininha, pequenininha, de olhos bem abertos. Olá, [Nome]. Você já está em casa.',
    },
    coverImage: '/samples/cuando-naciste.webp',
  },
  {
    ...BABY_BASE,
    slug: 'los-mejores-del-mundo',
    order: 47,
    palette: 'celebration',
    collectionIds: ['nuestros-recuerdos'],
    suggestedLessons: [],
    tags: ['mamá', 'papá', 'amor', 'regalo', 'Día de la Madre', 'Día del Padre'],
    title: {
      es: 'Los mejores del mundo, según [Nombre]',
      en: 'The Best in the World, According to [Name]',
      pt: 'Os melhores do mundo, segundo [Nome]',
    },
    summary: {
      es: 'Lo que [Nombre] más quiere en el mundo: mamá y papá (o quien lo cuide). Los abrazos, las cosquillas y el cuento de la noche que los hacen los mejores. Para el Día de la Madre, el del Padre o cualquier día.',
      en: 'What [Name] loves most in the world: Mom and Dad (or whoever takes care of them). The hugs, the tickles and the bedtime story that make them the best. For Mother’s Day, Father’s Day or any day.',
      pt: 'O que [Nome] mais ama no mundo: mamãe e papai (ou quem cuida). Os abraços, as cócegas e a história de dormir que os tornam os melhores. Para o Dia das Mães, o dos Pais ou qualquer dia.',
    },
    excerpt: {
      es: 'Mamá me abraza fuerte, fuerte. Papá me hace cosquillas, cosquillas. Los mejores del mundo, dice [Nombre]. ¡Y los quiere, y los quiere, y los quiere!',
      en: 'Mom hugs me tight, tight. Dad tickles me, tickles me. The best in the world, says [Name]. And I love them, and I love them, and I love them!',
      pt: 'A mamãe me abraça forte, forte. O papai me faz cócegas, cócegas. Os melhores do mundo, diz [Nome]. E eu os amo, e os amo, e os amo!',
    },
    coverImage: '/samples/los-mejores-del-mundo.webp',
  },
  {
    ...BABY_BASE,
    slug: 'chau-panal',
    order: 48,
    ageMin: 2,
    ageMax: 3,
    palette: 'learning',
    collectionIds: ['grandes-momentos'],
    suggestedLessons: ['dejar-el-panal-o-el-chupete'],
    tags: ['pañal', 'hitos', 'bebés'],
    title: {
      es: 'Chau, pañal, [Nombre]',
      en: 'Bye-Bye, Diaper, [Name]',
      pt: 'Tchau, fralda, [Nome]',
    },
    summary: {
      es: 'Un libro para despedirse del pañal: la bacinica, los intentos, las risas y la alegría de “¡lo logré!”. Con rima, repetición y sin apuros.',
      en: 'A book for saying goodbye to diapers: the potty, the tries, the giggles and the joy of “I did it!”. With rhyme, repetition and no rush.',
      pt: 'Um livro para se despedir da fralda: o peniquinho, as tentativas, as risadas e a alegria do “consegui!”. Com rima, repetição e sem pressa.',
    },
    excerpt: {
      es: 'Chau, pañal. Hola, bacinica. Un intento, dos intentos… ¡plop! ¡Lo logró [Nombre]! Y todos aplauden: ¡bravo, bravo, bravo!',
      en: 'Bye-bye, diaper. Hello, potty. One try, two tries… plop! [Name] did it! And everyone claps: hooray, hooray, hooray!',
      pt: 'Tchau, fralda. Olá, peniquinho. Uma tentativa, duas tentativas… plop! [Nome] conseguiu! E todos aplaudem: oba, oba, oba!',
    },
    coverImage: '/samples/chau-panal.webp',
  },
  {
    ...DRAFT_BASE,
    slug: 'el-volcan-del-enojo',
    order: 49,
    ageMin: 3,
    ageMax: 5,
    palette: 'magic',
    collectionIds: ['grandes-momentos'],
    suggestedLessons: ['manejar-el-enojo', 'calma-cuando-estoy-nervioso'],
    tags: ['enojo', 'emociones', 'calma'],
    title: {
      es: '[Nombre] y el volcán del enojo',
      en: '[Name] and the Anger Volcano',
      pt: '[Nome] e o vulcão da raiva',
    },
    summary: {
      es: 'Cuando algo sale mal, adentro de [Nombre] empieza a burbujear un volcán. Con respiraciones, un abrazo y un amigo, aprende a dejarlo salir sin que queme a nadie.',
      en: 'When something goes wrong, a volcano starts to bubble inside [Name]. With deep breaths, a hug and a friend, the volcano learns to let it out without burning anyone.',
      pt: 'Quando algo dá errado, um vulcão começa a borbulhar dentro de [Nome]. Com respirações, um abraço e um amigo, aprende a deixá-lo sair sem queimar ninguém.',
    },
    excerpt: {
      es: 'La torre de bloques se cayó y, dentro de [Nombre], algo empezó a burbujear: glu, glu, glu. —¡Es mi volcán! —dijo, apretando los puños. Respiró hondo, una, dos, tres veces… y el volcán se calmó.',
      en: 'The block tower fell down and, inside [Name], something began to bubble: glug, glug, glug. "It’s my volcano!" [Name] said, clenching both fists. A deep breath, one, two, three times… and the volcano calmed down.',
      pt: 'A torre de blocos caiu e, dentro de [Nome], algo começou a borbulhar: glu, glu, glu. — É o meu vulcão! — disse, apertando os punhos. Respirou fundo, uma, duas, três vezes… e o vulcão se acalmou.',
    },
    coverImage: '/samples/el-volcan-del-enojo.webp',
  },
  {
    ...DRAFT_BASE,
    slug: 'el-diente-que-se-cayo',
    textPromptTemplate: TOOTH_PROMPT,
    order: 50,
    ageMin: 5,
    ageMax: 8,
    palette: 'learning',
    collectionIds: ['grandes-momentos'],
    suggestedLessons: ['valentia', 'calma-cuando-estoy-nervioso'],
    tags: ['diente', 'ratón Pérez', 'hitos'],
    title: {
      es: '[Nombre] y el diente que se cayó',
      en: '[Name] and the Wobbly Tooth',
      pt: '[Nome] e o dente que caiu',
    },
    summary: {
      es: 'El primer diente se mueve, se mueve… y se cae. Una historia para perder el miedo, contar el gran momento y esperar la visita nocturna: Ratón Pérez, hada de los dientes o Fada do Dente, según el idioma.',
      en: 'The first tooth wobbles, wobbles… and falls out. A story to lose the fear, tell the big moment and wait for the night visitor: the Tooth Fairy, Ratón Pérez or Fada do Dente, depending on the language.',
      pt: 'O primeiro dente balança, balança… e cai. Uma história para perder o medo, contar o grande momento e esperar a visita da noite: Fada do Dente, Ratón Pérez ou a fada dos dentes, conforme o idioma.',
    },
    excerpt: {
      es: '—¡Se me mueve! —dijo [Nombre], con el dedo en la boca. Esa noche puso el diente bajo la almohada y se quedó despierta, despierta, despierta… hasta que oyó unos pasitos.',
      en: '"It’s wobbling!" said [Name], finger in mouth. That night [Name] put the tooth under the pillow and stayed awake, awake, awake… until tiny footsteps came.',
      pt: '— Está mexendo! — disse [Nome], com o dedo na boca. Naquela noite colocou o dente embaixo do travesseiro e ficou acordada, acordada, acordada… até ouvir uns passinhos.',
    },
    coverImage: '/samples/el-diente-que-se-cayo.webp',
  },
  {
    ...DRAFT_BASE,
    slug: 'el-club-de-detectives',
    order: 51,
    ageMin: 6,
    ageMax: 8,
    palette: 'explorer',
    collectionIds: ['aventuras'],
    suggestedLessons: ['amistad', 'lograr-lo-que-te-propongas'],
    tags: ['misterio', 'detectives', 'humor'],
    title: {
      es: 'El club de detectives de [Nombre]',
      en: "[Name]'s Detective Club",
      pt: 'O clube de detetives de [Nome]',
    },
    summary: {
      es: 'Desaparecen las galletas del recreo y solo hay una lupa, una libreta y tres amigos para resolver el caso. Un misterio con humor, de capítulos cortos, para leer solo.',
      en: 'The recess cookies disappear, and all there is to solve the case is a magnifying glass, a notebook and three friends. A mystery with humor and short chapters, to read alone.',
      pt: 'Os biscoitos do recreio somem, e só há uma lupa, um caderno e três amigos para resolver o caso. Um mistério com humor, de capítulos curtos, para ler sozinho.',
    },
    excerpt: {
      es: 'Caso número uno: ¿quién se comió las galletas del recreo? [Nombre] sacó la lupa, anotó tres pistas en su libreta y siguió las migas… que llevaban directo al perro del conserje.',
      en: 'Case number one: who ate the recess cookies? [Name] took out the magnifying glass, wrote three clues in the notebook and followed the crumbs… straight to the janitor’s dog.',
      pt: 'Caso número um: quem comeu os biscoitos do recreio? [Nome] pegou a lupa, anotou três pistas no caderno e seguiu as migalhas… direto até o cachorro do zelador.',
    },
    coverImage: '/samples/el-club-de-detectives.webp',
  },
  {
    ...BIG_READER_BASE,
    slug: 'dentro-del-videojuego',
    order: 52,
    suggestedLessons: ['valentia', 'lograr-lo-que-te-propongas'],
    palette: 'explorer',
    tags: ['videojuegos', 'aventura', 'misterio'],
    title: {
      es: 'Dentro del videojuego de [Nombre]',
      en: "Inside [Name]'s Video Game",
      pt: 'Dentro do videogame de [Nome]',
    },
    summary: {
      es: 'Un nivel nuevo, un control que no responde y una regla: para volver a casa hay que terminar el juego. Una novela corta de lógica y suspenso, en capítulos, para lectores grandes.',
      en: 'A new level, a controller that does not respond and one rule: to get home you have to finish the game. A short novel of logic and suspense, in chapters, for big readers.',
      pt: 'Uma fase nova, um controle que não responde e uma regra: para voltar para casa é preciso terminar o jogo. Uma novela curta de lógica e suspense, em capítulos, para leitores grandes.',
    },
    excerpt: {
      es: 'La pantalla parpadeó tres veces y el control quedó mudo. Cuando [Nombre] levantó la vista, el cuarto había desaparecido: bajo sus zapatillas había píxeles, y un cartel lejano anunciaba que el nivel uno ya había empezado.',
      en: 'The screen flickered three times and the controller went dead. When [Name] looked up, the room was gone: pixels lay under the sneakers, and a distant sign announced that level one had already begun.',
      pt: 'A tela piscou três vezes e o controle ficou mudo. Quando [Nome] levantou os olhos, o quarto tinha sumido: havia pixels sob os tênis, e uma placa distante anunciava que a fase um já tinha começado.',
    },
    coverImage: '/samples/dentro-del-videojuego.webp',
  },
  {
    ...DRAFT_BASE,
    slug: 'feliz-cumpleanos',
    order: 53,
    ageMin: 3,
    ageMax: 5,
    palette: 'celebration',
    collectionIds: ['grandes-momentos'],
    suggestedLessons: ['compartir', 'ser-uno-mismo'],
    tags: ['cumpleaños', 'regalo', 'fiesta'],
    title: {
      es: 'Feliz cumpleaños, [Nombre]',
      en: 'Happy Birthday, [Name]',
      pt: 'Feliz aniversário, [Nome]',
    },
    summary: {
      es: 'El regalo de cumpleaños que se queda: el día más esperado del año contado con la torta, las velas, los abrazos y los deseos de [Nombre]. Para regalar a quien cumple, con su cara de verdad en cada página.',
      en: 'The birthday gift that lasts: the most awaited day of the year told with the cake, the candles, the hugs and [Name]’s wishes. To give to the birthday child, with their real face on every page.',
      pt: 'O presente de aniversário que fica: o dia mais esperado do ano contado com o bolo, as velas, os abraços e os desejos de [Nome]. Para presentear quem faz aniversário, com o rosto de verdade em cada página.',
    },
    excerpt: {
      es: 'Hoy es el día de [Nombre]. Se despertó con olor a pastel y, en la mesa, el globo más grande de la casa. —¡Feliz cumpleaños! —cantaron todos, y [Nombre] pidió un deseo.',
      en: 'Today is [Name]’s day. [Name] woke up to the smell of cake and, on the table, the biggest balloon in the house. "Happy birthday!" everyone sang, and [Name] made a wish.',
      pt: 'Hoje é o dia de [Nome]. Acordou com cheiro de bolo e, na mesa, o maior balão da casa. — Feliz aniversário! — cantaram todos, e [Nome] fez um pedido.',
    },
    coverImage: '/samples/feliz-cumpleanos.webp',
  },
];

export const SEED_DRAFT_STORIES: SeedStory[] = DRAFT_STORIES.filter(
  (story) => !PENDING_COVER_SLUGS.includes(story.slug),
);

export const SEED_NEW_STORIES: SeedStory[] = [
  {
    ...NEW_STORY_BASE,
    slug: 'las-tardes-con-los-abuelos',
    suggestedLessons: ['compartir', 'decir-la-verdad', 'llega-un-hermanito', 'mudanza'],
    palette: 'bedtime',
    order: 20,
    ageMin: 6,
    ageMax: 8,
    channels: ['families'],
    collectionIds: ['nuestros-recuerdos'],
    title: {
      es: 'Las tardes de [Nombre] con los abuelos',
      en: "[Name]'s Afternoons with Grandma and Grandpa",
      pt: 'As tardes de [Nome] com os avós',
    },
    summary: {
      es: 'Una historia hecha con sus recuerdos favoritos con los abuelos: las recetas, los juegos y los secretos que solo ellos comparten.',
      en: 'A story made from their favorite memories with their grandparents: the recipes, the games and the secrets only they share.',
      pt: 'Uma história feita com as lembranças favoritas com os avós: as receitas, as brincadeiras e os segredos que só eles compartilham.',
    },
    excerpt: {
      es: '—¿Te acuerdas de la primera vez que hicimos galletas? —preguntó el abuelo. [Nombre] se rió: aquel día terminó con harina hasta en la nariz.',
      en: '"Do you remember the first time we baked cookies?" Grandpa asked. [Name] laughed: that day ended with flour all the way up her nose.',
      pt: '— Lembra da primeira vez que fizemos biscoitos? — perguntou o avô. [Nome] riu: aquele dia terminou com farinha até no nariz.',
    },
    coverImage: '/samples/las-tardes-con-los-abuelos.webp',
  },
  {
    ...NEW_STORY_BASE,
    slug: 'mi-primer-dia-de-clases',
    suggestedLessons: ['primer-dia-de-clases', 'calma-cuando-estoy-nervioso', 'amistad'],
    objectives: [
      {
        es: 'Anticipar cómo será el primer día',
        en: 'Know what the first day will be like',
        pt: 'Antecipar como será o primeiro dia',
      },
      {
        es: 'Despedirse con confianza',
        en: 'Say goodbye with confidence',
        pt: 'Despedir-se com confiança',
      },
      { es: 'Hacer un primer amigo', en: 'Make a first friend', pt: 'Fazer um primeiro amigo' },
      {
        es: 'Nombrar los nervios y calmarse',
        en: 'Name the nerves and calm down',
        pt: 'Nomear o nervosismo e se acalmar',
      },
    ],
    palette: 'learning',
    order: 21,
    ageMin: 3,
    ageMax: 5,
    channels: ['families', 'professionals'],
    collectionIds: ['grandes-momentos', 'mi-primera-experiencia'],
    title: {
      es: 'El primer día de clases de [Nombre]',
      en: "[Name]'s First Day of School",
      pt: 'O primeiro dia de aula de [Nome]',
    },
    summary: {
      es: 'La mochila nueva, el aula llena de colores y un compañero que también está nervioso. Un cuento para llegar al primer día con confianza.',
      en: 'A new backpack, a classroom full of colors and a classmate who is nervous too. A story to start the first day with confidence.',
      pt: 'A mochila nova, a sala cheia de cores e um colega que também está nervoso. Uma história para chegar ao primeiro dia com confiança.',
    },
    excerpt: {
      es: 'En la puerta del aula, [Nombre] apretó la mano de mamá. Entonces vio a un niño que también miraba sus zapatos. —Hola —le dijo—. ¿Te gustan los dinosaurios?',
      en: 'At the classroom door, [Name] squeezed Mom’s hand. Then she saw a boy who was also staring at his shoes. "Hi," she said. "Do you like dinosaurs?"',
      pt: 'Na porta da sala, [Nome] apertou a mão da mamãe. Então viu um menino que também olhava para os sapatos. — Oi — disse. — Você gosta de dinossauros?',
    },
    coverImage: '/samples/mi-primer-dia-de-clases.webp',
  },
  {
    ...NEW_STORY_BASE,
    slug: 'el-cumpleanos-mas-magico',
    suggestedLessons: ['compartir', 'amistad', 'ser-uno-mismo'],
    palette: 'celebration',
    order: 22,
    ageMin: 2,
    ageMax: 10,
    channels: ['events', 'families'],
    collectionIds: ['cumpleanos'],
    title: {
      es: 'El cumpleaños de [Nombre]',
      en: "[Name]'s Birthday",
      pt: 'O aniversário de [Nome]',
    },
    summary: {
      es: 'Las velas se encienden solas y la fiesta se convierte en una aventura. Un mini cuento con el cumpleañero como protagonista, para regalar a cada invitado.',
      en: 'The candles light up by themselves and the party becomes an adventure. A mini story starring the birthday child, to give to every guest.',
      pt: 'As velas se acendem sozinhas e a festa vira uma aventura. Uma mini história com o aniversariante como protagonista, para presentear cada convidado.',
    },
    excerpt: {
      es: 'Cuando [Nombre] sopló las velas, el pastel empezó a brillar. —¡Pide un deseo! —gritaron sus amigos. Y el deseo… ¡se hizo realidad!',
      en: 'When [Name] blew out the candles, the cake began to glow. "Make a wish!" the friends shouted. And the wish… came true!',
      pt: 'Quando [Nome] soprou as velas, o bolo começou a brilhar. — Faça um pedido! — gritaram os amigos. E o pedido… virou realidade!',
    },
    coverImage: '/samples/el-cumpleanos-mas-magico.webp',
  },
  {
    ...NEW_STORY_BASE,
    slug: 'las-letras-que-bailan',
    objectives: [
      {
        es: 'Reconocer letras y sus sonidos',
        en: 'Recognize letters and their sounds',
        pt: 'Reconhecer letras e seus sons',
      },
      { es: 'Jugar con la lectura', en: 'Play with reading', pt: 'Brincar com a leitura' },
      {
        es: 'Sentir curiosidad por las palabras',
        en: 'Feel curious about words',
        pt: 'Ter curiosidade pelas palavras',
      },
    ],
    palette: 'learning',
    order: 23,
    ageMin: 4,
    ageMax: 7,
    channels: ['professionals', 'families'],
    collectionIds: ['que-lindo-es-aprender'],
    title: {
      es: 'Las letras que bailan',
      en: 'The Dancing Letters',
      pt: 'As letras que dançam',
    },
    summary: {
      es: 'Las letras se escaparon del libro y solo quien las reconoce puede devolverlas a su lugar. Una aventura para jugar con la lectura.',
      en: 'The letters escaped from the book, and only someone who recognizes them can bring them back. An adventure to play with reading.',
      pt: 'As letras fugiram do livro e só quem as reconhece consegue devolvê-las ao lugar. Uma aventura para brincar com a leitura.',
    },
    excerpt: {
      es: 'La M se había escondido detrás de la montaña y la S se deslizaba como una serpiente. Una sonrisa enorme: —Ya sé cómo atraparlas.',
      en: 'The M was hiding behind the mountain and the S slid along like a snake. A huge smile: "I know how to catch them."',
      pt: 'O M tinha se escondido atrás da montanha e o S deslizava como uma serpente. Um sorriso enorme: — Já sei como pegá-las.',
    },
    coverImage: '/samples/las-letras-que-bailan.webp',
  },
  {
    ...NEW_STORY_BASE,
    slug: 'el-jardin-de-las-emociones',
    objectives: [
      { es: 'Reconocer emociones', en: 'Recognize feelings', pt: 'Reconhecer emoções' },
      {
        es: 'Ponerle palabras a lo que siente',
        en: 'Put feelings into words',
        pt: 'Colocar em palavras o que sente',
      },
      {
        es: 'Encontrar formas de calmarse',
        en: 'Find ways to calm down',
        pt: 'Encontrar formas de se acalmar',
      },
    ],
    palette: 'learning',
    order: 24,
    ageMin: 3,
    ageMax: 9,
    channels: ['professionals', 'families'],
    collectionIds: ['conozco-mis-emociones'],
    title: {
      es: 'El jardín de las emociones',
      en: 'The Garden of Feelings',
      pt: 'O jardim das emoções',
    },
    summary: {
      es: 'En este jardín cada flor guarda una emoción. Recorriéndolo, el protagonista aprende a reconocer lo que siente y a ponerlo en palabras.',
      en: 'In this garden every flower holds a feeling. Walking through it, the main character learns to recognize what they feel and put it into words.',
      pt: 'Neste jardim cada flor guarda uma emoção. Ao percorrê-lo, o protagonista aprende a reconhecer o que sente e a colocar em palavras.',
    },
    excerpt: {
      es: 'La flor roja temblaba como cuando uno se enoja. —Yo también me siento así a veces —susurró una voz—. ¿Respiramos juntos?',
      en: 'The red flower trembled the way you do when you get angry. "I feel like that sometimes too," came a whisper. "Shall we breathe together?"',
      pt: 'A flor vermelha tremia como quando a gente fica bravo. — Eu também me sinto assim às vezes — sussurrou uma voz. — Vamos respirar juntos?',
    },
    coverImage: '/samples/el-jardin-de-las-emociones.webp',
  },
  {
    ...NEW_STORY_BASE,
    slug: 'un-pasito-mas',
    objectives: [
      { es: 'Tolerar la frustración', en: 'Cope with frustration', pt: 'Tolerar a frustração' },
      {
        es: 'Valorar el esfuerzo y los avances',
        en: 'Value effort and progress',
        pt: 'Valorizar o esforço e os avanços',
      },
      {
        es: 'Animarse a pedir ayuda',
        en: 'Feel able to ask for help',
        pt: 'Ter coragem de pedir ajuda',
      },
    ],
    palette: 'learning',
    order: 25,
    ageMin: 3,
    ageMax: 9,
    channels: ['professionals', 'families'],
    collectionIds: ['mis-pequenos-logros'],
    title: { es: 'Un pasito más', en: 'One More Little Step', pt: 'Mais um passinho' },
    summary: {
      es: 'Subir la montaña parece imposible, hasta que el protagonista descubre que cada pasito cuenta y que pedir ayuda también es valiente.',
      en: 'Climbing the mountain seems impossible, until the main character discovers that every little step counts and that asking for help is brave too.',
      pt: 'Subir a montanha parece impossível, até que o protagonista descobre que cada passinho conta e que pedir ajuda também é coragem.',
    },
    excerpt: {
      es: 'Ayer no llegaba ni a la primera piedra. Hoy llegó al árbol grande. —¡Mira cuánto avanzaste! —dijo el zorro.',
      en: 'Yesterday the first rock was out of reach. Today, the big tree. "Look how far you’ve come!" said the fox.',
      pt: 'Ontem nem a primeira pedra dava para alcançar. Hoje, a árvore grande. — Veja quanto você avançou! — disse a raposa.',
    },
    coverImage: '/samples/un-pasito-mas.webp',
  },
  {
    ...NEW_STORY_BASE,
    slug: 'mi-visita-al-dentista',
    objectives: [
      {
        es: 'Conocer el consultorio antes de ir',
        en: 'Get to know the dental office before going',
        pt: 'Conhecer o consultório antes de ir',
      },
      {
        es: 'Anticipar los pasos de una consulta',
        en: 'Know the steps of a routine visit',
        pt: 'Antecipar os passos de uma consulta',
      },
      {
        es: 'Familiarizarse con los instrumentos',
        en: 'Become familiar with the tools',
        pt: 'Familiarizar-se com os instrumentos',
      },
      {
        es: 'Hablar de las dudas y los miedos',
        en: 'Talk about questions and worries',
        pt: 'Falar sobre dúvidas e medos',
      },
    ],
    palette: 'learning',
    order: 26,
    ageMin: 3,
    ageMax: 8,
    channels: ['professionals', 'families'],
    collectionIds: ['mi-primera-experiencia'],
    title: {
      es: 'Mi visita al dentista',
      en: 'My Visit to the Dentist',
      pt: 'Minha visita ao dentista',
    },
    summary: {
      es: 'La silla que sube y baja, la luz que parece un sol y una dentista muy amable. Un cuento para conocer la consulta antes de ir.',
      en: 'The chair that goes up and down, the light that looks like a sun and a very kind dentist. A story to get to know the visit before going.',
      pt: 'A cadeira que sobe e desce, a luz que parece um sol e uma dentista muito simpática. Uma história para conhecer a consulta antes de ir.',
    },
    excerpt: {
      es: '—¿Puedo contar tus dientes? —preguntó la dentista. La boca se abrió grande, como un león. —¡Veinte dientes brillantes! —anunció ella.',
      en: '"May I count your teeth?" the dentist asked. The mouth opened wide, like a lion. "Twenty shiny teeth!" she announced.',
      pt: '— Posso contar seus dentes? — perguntou a dentista. A boca se abriu bem, como um leão. — Vinte dentes brilhantes! — anunciou ela.',
    },
    coverImage: '/samples/mi-visita-al-dentista.webp',
  },
  // --- Para grandes lectores (9 a 12): tramas más largas, nada aniñado. ---
  {
    ...BIG_READER_BASE,
    slug: 'el-misterio-del-faro',
    ageMin: 9,
    ageMax: 12,
    suggestedLessons: [
      'valentia',
      'decir-la-verdad',
      'lograr-lo-que-te-propongas',
      'ser-uno-mismo',
    ],
    palette: 'explorer',
    order: 30,
    tags: ['misterio', 'detectives', 'mar'],
    title: {
      es: '[Nombre] y el misterio del faro',
      en: '[Name] and the Lighthouse Mystery',
      pt: '[Nome] e o mistério do farol',
    },
    summary: {
      es: 'Cada noche, la luz del faro del pueblo se apaga a la misma hora. Con una libreta, una linterna y mucha paciencia, tu peque sigue las pistas hasta descubrir un secreto que nadie esperaba.',
      en: 'Every night, the town lighthouse goes dark at exactly the same time. With a notebook, a flashlight and a lot of patience, your child follows the clues to a secret nobody expected.',
      pt: 'Toda noite, a luz do farol da cidade se apaga no mesmo horário. Com um caderno, uma lanterna e muita paciência, seu pequeno segue as pistas até descobrir um segredo que ninguém esperava.',
    },
    excerpt: {
      es: 'A las nueve y trece en punto, la luz del faro se apagó otra vez. [Nombre] anotó la hora en su libreta, debajo de las otras seis. —No es una falla —murmuró—. Es una señal.',
      en: 'At exactly nine thirteen, the lighthouse went dark again. [Name] wrote the time in a notebook, under the other six. "It isn’t a fault," came the whisper. "It’s a signal."',
      pt: 'Às nove e treze em ponto, a luz do farol se apagou outra vez. [Nome] anotou a hora no caderno, embaixo das outras seis. — Não é defeito — murmurou. — É um sinal.',
    },
    coverImage: '/samples/el-misterio-del-faro.webp',
  },
  {
    ...BIG_READER_BASE,
    slug: 'el-invento-que-se-escapo',
    // En pausa (DECISIONS 149): se superpone con otra historia de 9 a 12 años.
    active: false,
    suggestedLessons: [
      'equivocarse-esta-bien',
      'lograr-lo-que-te-propongas',
      'amistad',
      'manejar-el-enojo',
    ],
    palette: 'adventure',
    order: 31,
    tags: ['ciencia', 'inventos', 'robots', 'humor'],
    title: {
      es: 'El invento que se escapó',
      en: 'The Invention That Got Away',
      pt: 'A invenção que fugiu',
    },
    summary: {
      es: 'Para la feria de ciencias, tu peque construye un robot ayudante. Lo que no esperaba es que el robot tuviera ideas propias. Una aventura de inventos, errores y soluciones ingeniosas.',
      en: "For the science fair, your child builds a helper robot. What they didn't expect was a robot with ideas of its own. An adventure of inventions, mistakes and clever fixes.",
      pt: 'Para a feira de ciências, seu pequeno constrói um robô ajudante. O que ele não esperava era que o robô tivesse ideias próprias. Uma aventura de invenções, erros e soluções engenhosas.',
    },
    excerpt: {
      es: '—Prueba número catorce —dijo Tomás, y conectó el último cable. El robot abrió un ojo, después el otro, y preguntó: —¿Por qué tu cuarto está tan desordenado?',
      en: '"Test number fourteen," said Tomás, and he plugged in the last cable. The robot opened one eye, then the other, and asked: "Why is your room so messy?"',
      pt: '— Teste número catorze — disse Tomás, e ligou o último cabo. O robô abriu um olho, depois o outro, e perguntou: — Por que seu quarto está tão bagunçado?',
    },
    coverImage: '/samples/el-invento-que-se-escapo.webp',
  },
  {
    ...BIG_READER_BASE,
    slug: 'la-expedicion-del-mapa-perdido',
    // En pausa (DECISIONS 149): se superpone con otra historia de 9 a 12 años.
    active: false,
    suggestedLessons: ['valentia', 'respetar-las-diferencias', 'cuidar-la-naturaleza', 'amistad'],
    palette: 'nature',
    order: 32,
    tags: ['exploración', 'aventura', 'naturaleza'],
    title: {
      es: 'La expedición del mapa perdido',
      en: 'The Lost Map Expedition',
      pt: 'A expedição do mapa perdido',
    },
    summary: {
      es: 'Un mapa antiguo aparece dentro de un libro de la biblioteca. Selva, ríos y ruinas escondidas: una expedición en la que tu peque descifra símbolos y toma las decisiones del equipo.',
      en: 'An old map turns up inside a library book. Jungle, rivers and hidden ruins: an expedition where your child decodes symbols and makes the team’s decisions.',
      pt: 'Um mapa antigo aparece dentro de um livro da biblioteca. Selva, rios e ruínas escondidas: uma expedição em que seu pequeno decifra símbolos e toma as decisões da equipe.',
    },
    excerpt: {
      es: 'El mapa estaba doblado en ocho y olía a humedad. En una esquina, alguien había dibujado una brújula con una sola flecha. Lucas la giró hacia la ventana, y la flecha no apuntó al norte.',
      en: 'The map was folded in eight and smelled damp. In one corner, someone had drawn a compass with a single arrow. Lucas turned it toward the window, and the arrow didn’t point north.',
      pt: 'O mapa estava dobrado em oito e cheirava a umidade. Num canto, alguém tinha desenhado uma bússola com uma única seta. Lucas a virou para a janela, e a seta não apontou para o norte.',
    },
    coverImage: '/samples/la-expedicion-del-mapa-perdido.webp',
  },
  {
    ...BIG_READER_BASE,
    slug: 'un-lunes-al-reves',
    ageMin: 6,
    ageMax: 8,
    suggestedLessons: [
      'ser-uno-mismo',
      'equivocarse-esta-bien',
      'calma-cuando-estoy-nervioso',
      'manejar-el-enojo',
    ],
    palette: 'magic',
    order: 33,
    tags: ['humor', 'fantasía'],
    title: {
      es: 'El lunes al revés de [Nombre]',
      en: "[Name]'s Upside-Down Monday",
      pt: 'A segunda-feira ao contrário de [Nome]',
    },
    summary: {
      es: 'Un lunes, tu peque se despierta y todo funciona al revés: el perro pasea a la familia, los maestros hacen la tarea y la gravedad se toma el día libre. Para arreglarlo, tendrá que pensar al revés.',
      en: 'One Monday, your child wakes up and everything works backwards: the dog walks the family, the teachers do the homework and gravity takes the day off. To fix it, they will have to think backwards.',
      pt: 'Numa segunda-feira, seu pequeno acorda e tudo funciona ao contrário: o cachorro passeia com a família, os professores fazem a lição e a gravidade tira o dia de folga. Para consertar, ele vai ter que pensar ao contrário.',
    },
    excerpt: {
      es: '[Nombre] bajó a desayunar y encontró a su papá en el techo, untando una tostada. —Buen día —dijo su papá, flotando—. Hoy es uno de esos lunes.',
      en: '[Name] came down to breakfast and found Dad on the ceiling, buttering toast. "Good morning," said Dad, floating. "Today is one of those Mondays."',
      pt: '[Nome] desceu para o café e encontrou o pai no teto, passando manteiga numa torrada. — Bom dia — disse o pai, flutuando. — Hoje é uma daquelas segundas.',
    },
    coverImage: '/samples/un-lunes-al-reves.webp',
  },
];

/**
 * Orden de las direcciones de ilustración (auditoría del sitio, DECISIONS 153): el estilo de la
 * casa primero (Gouache editorial) y, al final, los que más se reconocen como IA.
 */
export const SEED_STYLES: SeedStyle[] = [
  {
    slug: 'acuarela',
    active: true,
    order: 6,
    name: { es: 'Acuarela', en: 'Watercolor', pt: 'Aquarela' },
    promptModifier: 'soft watercolor children book illustration, gentle textures, pastel palette',
    sampleImage: '/styles/acuarela.webp',
    contentTypes: ['story', 'activities', 'story_activities'],
  },
  {
    slug: 'cartoon-3d',
    active: true,
    order: 7,
    name: { es: 'Cartoon 3D', en: '3D cartoon', pt: 'Cartoon 3D' },
    promptModifier:
      '3D animated feature film style: rendered stylized characters with rounded proportions, soft global illumination, smooth materials, cinematic depth of field and vibrant colors; not a flat drawing, not watercolor',
    sampleImage: '/styles/cartoon-3d.webp',
    contentTypes: ['story', 'activities', 'story_activities'],
  },
  {
    slug: 'cuento-clasico',
    active: true,
    order: 4,
    name: { es: 'Cuento clásico', en: 'Classic storybook', pt: 'Conto clássico' },
    promptModifier:
      'classic narrative editorial illustration, ink line and opaque paint with moderate texture, believable gestures, warm vintage tones',
    sampleImage: '/styles/cuento-clasico.webp',
    contentTypes: ['story', 'activities', 'story_activities'],
  },
  {
    slug: 'lapices-de-colores',
    active: true,
    order: 5,
    name: { es: 'Lápices de colores', en: 'Colored pencils', pt: 'Lápis de cor' },
    promptModifier:
      'colored pencil drawing, imperfect human lines, visible strokes, paper grain and deliberately incomplete coloring',
    sampleImage: '/styles/lapices-de-colores.webp',
    contentTypes: ['story', 'activities', 'story_activities'],
  },
  // Tres direcciones nuevas para probar contra las actuales (DECISIONS 141). Sin imagen de muestra
  // hasta tener las miniaturas; el admin las puede apagar.
  {
    slug: 'collage-papel',
    active: true,
    order: 2,
    name: { es: 'Collage de papel', en: 'Paper collage', pt: 'Colagem de papel' },
    promptModifier:
      'cut-paper collage: clean cut-out contours, layered textured paper, visible paper fibers, very subtle shadows between layers, faces detailed enough to resemble the child',
    sampleImage: '/styles/collage-papel.webp',
    contentTypes: ['story', 'activities', 'story_activities'],
  },
  {
    slug: 'minimalismo-grafico',
    active: true,
    order: 3,
    name: { es: 'Minimalismo gráfico', en: 'Graphic minimalism', pt: 'Minimalismo gráfico' },
    promptModifier:
      'contemporary graphic minimalism: expressive silhouettes, simple backgrounds, a few colors, clear composition that reads as a thumbnail, distinctive faces true to the photo',
    sampleImage: '/styles/minimalismo-grafico.webp',
    contentTypes: ['story', 'activities', 'story_activities'],
  },
  {
    slug: 'gouache-editorial',
    active: true,
    order: 1,
    name: { es: 'Gouache editorial', en: 'Editorial gouache', pt: 'Guache editorial' },
    promptModifier:
      'traditional editorial gouache: matte pigment, irregular brush strokes, opaque layers, controlled palette, individual slightly angular faces',
    sampleImage: '/styles/gouache-editorial.webp',
    contentTypes: ['story', 'activities', 'story_activities'],
  },
  {
    // Solo para libros para colorear: contornos limpios, no una acuarela pasada a blanco y negro.
    slug: 'para-colorear',
    active: true,
    order: 8,
    name: { es: 'Para colorear', en: 'Coloring', pt: 'Para colorir' },
    promptModifier:
      'black and white coloring book line art for children, clean bold uniform outlines, no shading, no gray, no color fills, large simple shapes with wide areas to color, plain white background',
    sampleImage: '/styles/para-colorear.webp',
    contentTypes: ['coloring'],
  },
];

/** Actividades aprobadas: se generan a partir de la historia y se maquetan en las fases 09 y 10. */
export const SEED_ACTIVITY_TEMPLATES: (ActivityTemplate & { id: string })[] = [
  {
    id: 'maze',
    kind: 'maze',
    active: true,
    readingLevels: ['beginner', 'developing', 'advanced'],
    promptGuidance:
      'Laberinto simple para ayudar al protagonista a llegar a un objeto o personaje de la historia. Más caminos y vueltas en niveles más altos.',
  },
  {
    id: 'match',
    kind: 'match',
    active: true,
    readingLevels: ['beginner', 'developing'],
    promptGuidance:
      'Unir con flechas personajes u objetos de la historia con su sombra, su nombre o el lugar donde aparecen.',
  },
  {
    id: 'differences',
    kind: 'differences',
    active: true,
    readingLevels: ['developing', 'advanced'],
    promptGuidance:
      'Encontrar entre 3 y 7 diferencias entre dos versiones de una escena de la historia, según el nivel.',
  },
  {
    id: 'complete-sentence',
    kind: 'complete_sentence',
    active: true,
    readingLevels: ['developing', 'advanced'],
    promptGuidance:
      'Completar frases de la historia con una palabra (con opciones para elegir en el nivel en desarrollo).',
  },
  {
    id: 'draw-ending',
    kind: 'draw_ending',
    active: true,
    readingLevels: ['beginner', 'developing', 'advanced'],
    promptGuidance:
      'Dibujar otro final o el momento favorito de la historia, con una consigna breve adecuada al nivel.',
  },
];
