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

type SeedStory = Omit<Story, 'createdAt' | 'updatedAt'>;
type SeedStyle = Omit<IllustrationStyle, 'createdAt' | 'updatedAt'>;

const TEXT_PROMPT = `Escribe un cuento infantil de {{pageCount}} páginas titulado "{{storyTitle}}".
Protagonista: {{childName}}, {{age}} años (pronombre: {{pronouns}}). Le gusta: {{likes}}.
Mascota: {{petName}}. Mejor amigo o amiga: {{bestFriendName}}.
Enseñanzas para tejer en la trama:
{{lessons}}
Tono cálido y luminoso, un pequeño desafío y un final feliz.
Cada página: su texto y la escena para ilustrar.`;

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
    ageMax: 8,
    tags: ['espacio', 'aventura'],
    pageCount: 12,
    title: {
      es: 'La gran aventura espacial',
      en: 'The Great Space Adventure',
      pt: 'A grande aventura espacial',
    },
    summary: {
      es: 'Un cohete de cartón se convierte en una nave de verdad y lleva a tu peque a visitar planetas, hacer amigos entre las estrellas y volver a casa justo a tiempo para dormir.',
      en: 'A cardboard rocket turns into a real spaceship and takes your little one to visit planets, make friends among the stars, and get home just in time for bed.',
      pt: 'Um foguete de papelão vira uma nave de verdade e leva seu pequeno para visitar planetas, fazer amigos entre as estrelas e voltar para casa bem na hora de dormir.',
    },
    excerpt: {
      es: 'Esa noche, el cohete de cartón empezó a brillar. —¿Lista para despegar? —preguntó una voz desde la ventana. Martina se puso el casco, contó hasta tres… ¡y salieron disparados hacia la Luna!',
      en: 'That night, the cardboard rocket began to glow. "Ready for liftoff?" asked a voice from the window. Martina put on her helmet, counted to three… and off they zoomed to the Moon!',
      pt: 'Naquela noite, o foguete de papelão começou a brilhar. — Pronta para decolar? — perguntou uma voz na janela. Martina colocou o capacete, contou até três… e lá foram eles rumo à Lua!',
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
    ageMax: 7,
    tags: ['dinosaurios', 'naturaleza'],
    pageCount: 12,
    title: {
      es: 'El valle de los dinosaurios',
      en: 'The Valley of the Dinosaurs',
      pt: 'O vale dos dinossauros',
    },
    summary: {
      es: 'Detrás del jardín hay un valle secreto donde viven dinosaurios gigantes y muy amables. Tu peque los ayudará a encontrar un huevo perdido antes de que caiga el sol.',
      en: 'Behind the garden lies a secret valley where giant, very friendly dinosaurs live. Your little one will help them find a lost egg before the sun goes down.',
      pt: 'Atrás do jardim existe um vale secreto onde vivem dinossauros gigantes e muito gentis. Seu pequeno vai ajudá-los a encontrar um ovo perdido antes do pôr do sol.',
    },
    excerpt: {
      es: 'El suelo tembló: pum, pum, pum. Leo se escondió detrás de un helecho enorme… ¡y se encontró cara a cara con un triceratops que lloraba porque había perdido su huevo!',
      en: 'The ground shook: boom, boom, boom. Leo hid behind a giant fern… and came face to face with a triceratops who was crying because she had lost her egg!',
      pt: 'O chão tremeu: bum, bum, bum. Leo se escondeu atrás de uma samambaia enorme… e ficou cara a cara com um tricerátopo que chorava porque tinha perdido seu ovo!',
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
    ageMax: 8,
    tags: ['princesas', 'príncipes', 'magia'],
    pageCount: 12,
    title: { es: 'El reino encantado', en: 'The Enchanted Kingdom', pt: 'O reino encantado' },
    summary: {
      es: 'Un castillo en las nubes necesita a alguien valiente y bondadoso. Tu peque recibe una corona, un mapa mágico y una misión: devolverle los colores al reino.',
      en: 'A castle in the clouds needs someone brave and kind. Your little one receives a crown, a magic map, and a mission: bring the colors back to the kingdom.',
      pt: 'Um castelo nas nuvens precisa de alguém corajoso e bondoso. Seu pequeno recebe uma coroa, um mapa mágico e uma missão: devolver as cores ao reino.',
    },
    excerpt: {
      es: 'En el reino todo se había vuelto gris. —Solo quien tenga un corazón valiente podrá encontrar los colores —dijo la reina. Sofía apretó el mapa mágico y dio el primer paso.',
      en: 'Everything in the kingdom had turned gray. "Only someone with a brave heart can find the colors," said the queen. Sofia held the magic map tight and took the first step.',
      pt: 'No reino, tudo tinha ficado cinza. — Só quem tiver um coração corajoso poderá encontrar as cores — disse a rainha. Sofia segurou firme o mapa mágico e deu o primeiro passo.',
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
    ageMin: 4,
    ageMax: 10,
    tags: ['fútbol', 'deportes', 'amistad'],
    pageCount: 12,
    title: { es: '¡Gol de campeón!', en: "Champion's Goal!", pt: 'Gol de campeão!' },
    summary: {
      es: 'Es la final del torneo del barrio y el equipo necesita a su mejor jugador. Una historia sobre esfuerzo, compañerismo y el gol más importante del año.',
      en: "It's the final of the neighborhood tournament and the team needs its best player. A story about effort, teamwork, and the most important goal of the year.",
      pt: 'É a final do torneio do bairro e o time precisa do seu melhor jogador. Uma história sobre esforço, companheirismo e o gol mais importante do ano.',
    },
    excerpt: {
      es: 'Quedaba un minuto. Tomás miró a sus amigos, respiró hondo y corrió con la pelota pegada al pie. La tribuna entera se puso de pie: ¡goooool!',
      en: 'One minute left. Tomás looked at his friends, took a deep breath, and ran with the ball at his feet. The whole crowd jumped up: gooooal!',
      pt: 'Faltava um minuto. Tomás olhou para os amigos, respirou fundo e correu com a bola colada no pé. A arquibancada inteira se levantou: gooooool!',
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
    ageMin: 4,
    ageMax: 9,
    tags: ['superhéroes', 'valentía'],
    pageCount: 12,
    title: { es: 'Superhéroe por un día', en: 'Superhero for a Day', pt: 'Super-herói por um dia' },
    summary: {
      es: 'Una capa aparece misteriosamente en la cama de tu peque. Durante un día tendrá superpoderes… y descubrirá que el más grande de todos es ayudar a los demás.',
      en: "A cape mysteriously appears on your little one's bed. For one day they'll have superpowers… and discover that the greatest of all is helping others.",
      pt: 'Uma capa aparece misteriosamente na cama do seu pequeno. Por um dia ele terá superpoderes… e vai descobrir que o maior de todos é ajudar os outros.',
    },
    excerpt: {
      es: 'La capa roja tenía una nota: «Válida por un día». Valentina se la ató al cuello y, de pronto, ¡sus pies se despegaron del piso!',
      en: 'The red cape came with a note: "Valid for one day." Valentina tied it around her neck and, suddenly, her feet lifted off the floor!',
      pt: 'A capa vermelha tinha um bilhete: "Válida por um dia". Valentina amarrou a capa no pescoço e, de repente, seus pés saíram do chão!',
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
    ageMin: 2,
    ageMax: 7,
    tags: ['animales', 'naturaleza', 'amistad'],
    pageCount: 12,
    title: { es: 'Amigos de la selva', en: 'Jungle Friends', pt: 'Amigos da selva' },
    summary: {
      es: 'Un tucán parlanchín invita a tu peque a recorrer la selva: monos acróbatas, un jaguar dormilón y un río lleno de sorpresas.',
      en: 'A chatty toucan invites your little one to explore the jungle: acrobatic monkeys, a sleepy jaguar and a river full of surprises.',
      pt: 'Um tucano tagarela convida seu pequeno para explorar a selva: macacos acrobatas, uma onça dorminhoca e um rio cheio de surpresas.',
    },
    excerpt: {
      es: '—¡Por aquí! —gritó el tucán desde una rama. Valentina apartó unas hojas enormes y vio un río que brillaba como un espejo. Del otro lado, tres monitos la saludaban.',
      en: '"This way!" called the toucan from a branch. Valentina pushed aside some huge leaves and saw a river shining like a mirror. On the other side, three little monkeys were waving at her.',
      pt: '— Por aqui! — gritou o tucano de um galho. Valentina afastou umas folhas enormes e viu um rio que brilhava como um espelho. Do outro lado, três macaquinhos acenavam para ela.',
    },
    coverImage: '/samples/amigos-de-la-selva.webp',
    samplePages: [],
    textPromptTemplate: TEXT_PROMPT,
    imagePromptTemplate: IMAGE_PROMPT,
    ...EDITORIAL_OPTIONS,
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
    ageMax: 8,
    tags: ['mar', 'aventura', 'naturaleza'],
    pageCount: 12,
    title: {
      es: 'El secreto del fondo del mar',
      en: 'The Secret of the Deep Sea',
      pt: 'O segredo do fundo do mar',
    },
    summary: {
      es: 'Con una burbuja mágica para respirar bajo el agua, tu peque nada entre delfines, tortugas y corales para descubrir un tesoro muy especial.',
      en: 'With a magic bubble to breathe underwater, your little one swims with dolphins, turtles and corals to discover a very special treasure.',
      pt: 'Com uma bolha mágica para respirar debaixo d’água, seu pequeno nada entre golfinhos, tartarugas e corais para descobrir um tesouro muito especial.',
    },
    excerpt: {
      es: 'La burbuja hizo «plop» y, de pronto, Martín podía respirar bajo el agua. Una tortuga muy anciana le guiñó un ojo: —Te estábamos esperando. El tesoro necesita a alguien como tú.',
      en: 'The bubble went "plop" and suddenly Martín could breathe underwater. A very old turtle winked at him: "We were waiting for you. The treasure needs someone like you."',
      pt: 'A bolha fez "plop" e, de repente, Martín conseguia respirar debaixo d’água. Uma tartaruga bem velhinha piscou para ele: — Estávamos esperando você. O tesouro precisa de alguém como você.',
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
  pageCount: 12,
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

export const SEED_NEW_STORIES: SeedStory[] = [
  {
    ...NEW_STORY_BASE,
    slug: 'las-tardes-con-los-abuelos',
    suggestedLessons: ['compartir', 'decir-la-verdad', 'llega-un-hermanito', 'mudanza'],
    palette: 'bedtime',
    order: 20,
    ageMin: 2,
    ageMax: 9,
    channels: ['families'],
    collectionIds: ['nuestros-recuerdos'],
    title: {
      es: 'Las tardes con los abuelos',
      en: 'Afternoons with Grandma and Grandpa',
      pt: 'As tardes com os avós',
    },
    summary: {
      es: 'Una historia hecha con sus recuerdos favoritos con los abuelos: las recetas, los juegos y los secretos que solo ellos comparten.',
      en: 'A story made from their favorite memories with their grandparents: the recipes, the games and the secrets only they share.',
      pt: 'Uma história feita com as lembranças favoritas com os avós: as receitas, as brincadeiras e os segredos que só eles compartilham.',
    },
    excerpt: {
      es: '—¿Te acuerdas de la primera vez que hicimos galletas? —preguntó el abuelo. Martina se rió: aquel día terminó con harina hasta en la nariz.',
      en: '"Do you remember the first time we baked cookies?" Grandpa asked. Martina laughed: that day ended with flour all the way up her nose.',
      pt: '— Lembra da primeira vez que fizemos biscoitos? — perguntou o avô. Martina riu: aquele dia terminou com farinha até no nariz.',
    },
    coverImage: '/samples/las-tardes-con-los-abuelos.webp',
  },
  {
    ...NEW_STORY_BASE,
    slug: 'mi-primer-dia-de-clases',
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
    ageMax: 7,
    channels: ['families', 'professionals'],
    collectionIds: ['grandes-momentos', 'mi-primera-experiencia'],
    title: {
      es: 'Mi primer día de clases',
      en: 'My First Day of School',
      pt: 'Meu primeiro dia de aula',
    },
    summary: {
      es: 'La mochila nueva, el aula llena de colores y un compañero que también está nervioso. Un cuento para llegar al primer día con confianza.',
      en: 'A new backpack, a classroom full of colors and a classmate who is nervous too. A story to start the first day with confidence.',
      pt: 'A mochila nova, a sala cheia de cores e um colega que também está nervoso. Uma história para chegar ao primeiro dia com confiança.',
    },
    excerpt: {
      es: 'En la puerta del aula, Leo apretó la mano de mamá. Entonces vio a un niño que también miraba sus zapatos. —Hola —le dijo—. ¿Te gustan los dinosaurios?',
      en: 'At the classroom door, Leo squeezed Mom’s hand. Then he saw a boy who was also staring at his shoes. "Hi," he said. "Do you like dinosaurs?"',
      pt: 'Na porta da sala, Leo apertou a mão da mamãe. Então viu um menino que também olhava para os sapatos. — Oi — disse. — Você gosta de dinossauros?',
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
      es: 'El cumpleaños más mágico',
      en: 'The Most Magical Birthday',
      pt: 'O aniversário mais mágico',
    },
    summary: {
      es: 'Las velas se encienden solas y la fiesta se convierte en una aventura. Un mini cuento con el cumpleañero como protagonista, para regalar a cada invitado.',
      en: 'The candles light up by themselves and the party becomes an adventure. A mini story starring the birthday child, to give to every guest.',
      pt: 'As velas se acendem sozinhas e a festa vira uma aventura. Uma mini história com o aniversariante como protagonista, para presentear cada convidado.',
    },
    excerpt: {
      es: 'Cuando Mateo sopló las velas, el pastel empezó a brillar. —¡Pide un deseo! —gritaron sus amigos. Y el deseo… ¡se hizo realidad!',
      en: 'When Mateo blew out the candles, the cake began to glow. "Make a wish!" his friends shouted. And the wish… came true!',
      pt: 'Quando Mateo soprou as velas, o bolo começou a brilhar. — Faça um pedido! — gritaram os amigos. E o pedido… virou realidade!',
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
      es: 'La M se había escondido detrás de la montaña y la S se deslizaba como una serpiente. Sofía sonrió: ya sabía cómo atraparlas.',
      en: 'The M was hiding behind the mountain and the S slid along like a snake. Sofia smiled: she already knew how to catch them.',
      pt: 'O M tinha se escondido atrás da montanha e o S deslizava como uma serpente. Sofia sorriu: já sabia como pegá-las.',
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
      es: 'La flor roja temblaba como cuando uno se enoja. Lucas se agachó y le dijo bajito: —Yo también me siento así a veces. ¿Respiramos juntos?',
      en: 'The red flower trembled the way you do when you get angry. Lucas crouched down and whispered: "I feel like that sometimes too. Shall we breathe together?"',
      pt: 'A flor vermelha tremia como quando a gente fica bravo. Lucas se abaixou e disse baixinho: — Eu também me sinto assim às vezes. Vamos respirar juntos?',
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
      es: 'Ayer no llegaba ni a la primera piedra. Hoy Martina llegó al árbol grande. —¡Mira cuánto avanzaste! —le dijo el zorro.',
      en: 'Yesterday she couldn’t even reach the first rock. Today Martina reached the big tree. "Look how far you’ve come!" said the fox.',
      pt: 'Ontem ela não chegava nem à primeira pedra. Hoje Martina chegou à árvore grande. — Veja quanto você avançou! — disse a raposa.',
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
      es: '—¿Puedo contar tus dientes? —preguntó la dentista. Mateo abrió grande la boca, como un león. —¡Veinte dientes brillantes! —anunció ella.',
      en: '"May I count your teeth?" the dentist asked. Mateo opened wide, like a lion. "Twenty shiny teeth!" she announced.',
      pt: '— Posso contar seus dentes? — perguntou a dentista. Mateo abriu bem a boca, como um leão. — Vinte dentes brilhantes! — anunciou ela.',
    },
    coverImage: '/samples/mi-visita-al-dentista.webp',
  },
  // --- Para grandes lectores (9 a 12): tramas más largas, nada aniñado. ---
  {
    ...BIG_READER_BASE,
    slug: 'el-misterio-del-faro',
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
      es: 'El misterio del faro dormido',
      en: 'The Mystery of the Sleeping Lighthouse',
      pt: 'O mistério do farol adormecido',
    },
    summary: {
      es: 'Cada noche, la luz del faro del pueblo se apaga a la misma hora. Con una libreta, una linterna y mucha paciencia, tu hijo sigue las pistas hasta descubrir un secreto que nadie esperaba.',
      en: 'Every night, the town lighthouse goes dark at exactly the same time. With a notebook, a flashlight and a lot of patience, your child follows the clues to a secret nobody expected.',
      pt: 'Toda noite, a luz do farol da cidade se apaga no mesmo horário. Com um caderno, uma lanterna e muita paciência, seu filho segue as pistas até descobrir um segredo que ninguém esperava.',
    },
    excerpt: {
      es: 'A las nueve y trece en punto, la luz del faro se apagó otra vez. Valentina anotó la hora en su libreta, debajo de las otras seis. —No es una falla —murmuró—. Es una señal.',
      en: 'At exactly nine thirteen, the lighthouse went dark again. Valentina wrote the time in her notebook, under the other six. "It isn’t a fault," she whispered. "It’s a signal."',
      pt: 'Às nove e treze em ponto, a luz do farol se apagou outra vez. Valentina anotou a hora no caderno, embaixo das outras seis. — Não é defeito — murmurou. — É um sinal.',
    },
    coverImage: '/samples/el-misterio-del-faro.webp',
  },
  {
    ...BIG_READER_BASE,
    slug: 'el-invento-que-se-escapo',
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
      es: 'Para la feria de ciencias, tu hijo construye un robot ayudante. Lo que no esperaba es que el robot tuviera ideas propias. Una aventura de inventos, errores y soluciones ingeniosas.',
      en: "For the science fair, your child builds a helper robot. What they didn't expect was a robot with ideas of its own. An adventure of inventions, mistakes and clever fixes.",
      pt: 'Para a feira de ciências, seu filho constrói um robô ajudante. O que ele não esperava era que o robô tivesse ideias próprias. Uma aventura de invenções, erros e soluções engenhosas.',
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
      es: 'Un mapa antiguo aparece dentro de un libro de la biblioteca. Selva, ríos y ruinas escondidas: una expedición en la que tu hijo descifra símbolos y toma las decisiones del equipo.',
      en: 'An old map turns up inside a library book. Jungle, rivers and hidden ruins: an expedition where your child decodes symbols and makes the team’s decisions.',
      pt: 'Um mapa antigo aparece dentro de um livro da biblioteca. Selva, rios e ruínas escondidas: uma expedição em que seu filho decifra símbolos e toma as decisões da equipe.',
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
      es: 'Un lunes completamente al revés',
      en: 'A Completely Upside-Down Monday',
      pt: 'Uma segunda-feira completamente ao contrário',
    },
    summary: {
      es: 'Un lunes, tu hijo se despierta y todo funciona al revés: el perro pasea a la familia, los maestros hacen la tarea y la gravedad se toma el día libre. Para arreglarlo, tendrá que pensar al revés.',
      en: 'One Monday, your child wakes up and everything works backwards: the dog walks the family, the teachers do the homework and gravity takes the day off. To fix it, they will have to think backwards.',
      pt: 'Numa segunda-feira, seu filho acorda e tudo funciona ao contrário: o cachorro passeia com a família, os professores fazem a lição e a gravidade tira o dia de folga. Para consertar, ele vai ter que pensar ao contrário.',
    },
    excerpt: {
      es: 'Joaquín bajó a desayunar y encontró a su papá en el techo, untando una tostada. —Buen día —dijo su papá, flotando—. Hoy es uno de esos lunes.',
      en: 'Joaquín came down to breakfast and found his dad on the ceiling, buttering toast. "Good morning," said his dad, floating. "Today is one of those Mondays."',
      pt: 'Joaquín desceu para o café e encontrou o pai no teto, passando manteiga numa torrada. — Bom dia — disse o pai, flutuando. — Hoje é uma daquelas segundas.',
    },
    coverImage: '/samples/un-lunes-al-reves.webp',
  },
];

export const SEED_STYLES: SeedStyle[] = [
  {
    slug: 'acuarela',
    active: true,
    order: 1,
    name: { es: 'Acuarela', en: 'Watercolor', pt: 'Aquarela' },
    promptModifier: 'soft watercolor children book illustration, gentle textures, pastel palette',
    sampleImage: '/styles/acuarela.webp',
    contentTypes: ['story', 'activities', 'story_activities'],
  },
  {
    slug: 'cartoon-3d',
    active: true,
    order: 2,
    name: { es: 'Cartoon 3D', en: '3D cartoon', pt: 'Cartoon 3D' },
    promptModifier:
      '3D animated feature film style: rendered stylized characters with rounded proportions, soft global illumination, smooth materials, cinematic depth of field and vibrant colors; not a flat drawing, not watercolor',
    sampleImage: '/styles/cartoon-3d.webp',
    contentTypes: ['story', 'activities', 'story_activities'],
  },
  {
    slug: 'cuento-clasico',
    active: true,
    order: 3,
    name: { es: 'Cuento clásico', en: 'Classic storybook', pt: 'Conto clássico' },
    promptModifier:
      'classic narrative editorial illustration, ink line and opaque paint with moderate texture, believable gestures, warm vintage tones',
    sampleImage: '/styles/cuento-clasico.webp',
    contentTypes: ['story', 'activities', 'story_activities'],
  },
  {
    slug: 'lapices-de-colores',
    active: true,
    order: 4,
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
    order: 5,
    name: { es: 'Collage de papel', en: 'Paper collage', pt: 'Colagem de papel' },
    promptModifier:
      'cut-paper collage: clean cut-out contours, layered textured paper, visible paper fibers, very subtle shadows between layers, faces detailed enough to resemble the child',
    sampleImage: null,
    contentTypes: ['story', 'activities', 'story_activities'],
  },
  {
    slug: 'minimalismo-grafico',
    active: true,
    order: 6,
    name: { es: 'Minimalismo gráfico', en: 'Graphic minimalism', pt: 'Minimalismo gráfico' },
    promptModifier:
      'contemporary graphic minimalism: expressive silhouettes, simple backgrounds, a few colors, clear composition that reads as a thumbnail, distinctive faces true to the photo',
    sampleImage: null,
    contentTypes: ['story', 'activities', 'story_activities'],
  },
  {
    slug: 'gouache-editorial',
    active: true,
    order: 7,
    name: { es: 'Gouache editorial', en: 'Editorial gouache', pt: 'Guache editorial' },
    promptModifier:
      'traditional editorial gouache: matte pigment, irregular brush strokes, opaque layers, controlled palette, individual slightly angular faces',
    sampleImage: null,
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
    sampleImage: null,
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
