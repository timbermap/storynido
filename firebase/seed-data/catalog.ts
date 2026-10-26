/**
 * Catálogo de ejemplo: 7 aventuras y 4 estilos en los tres idiomas. Las enseñanzas están en lessons.ts.
 * Es el punto de partida; después se edita desde el panel admin (fase 14).
 */
import type { IllustrationStyle, Story } from '@storynido/shared';

type SeedStory = Omit<Story, 'createdAt' | 'updatedAt'>;
type SeedStyle = Omit<IllustrationStyle, 'createdAt' | 'updatedAt'>;

const TEXT_PROMPT = `Escribe un cuento infantil de {{pageCount}} páginas titulado "{{storyTitle}}".
Protagonista: {{childName}}, {{age}} años (pronombre: {{pronouns}}). Le gusta: {{likes}}.
Mascota: {{petName}}. Mejor amigo o amiga: {{bestFriendName}}.
Enseñanzas para tejer en la trama:
{{lessons}}
Tono cálido y luminoso, frases cortas adecuadas a la edad, un pequeño desafío y un final feliz.
Cada página: de 2 a 4 oraciones y la escena para ilustrar.`;

const IMAGE_PROMPT = `Children's picture book illustration: {{scene}}. Main character: {{character}}. Art style: {{style}}. Clear composition, warm light, no text in the image.`;

export const SEED_STORIES: SeedStory[] = [
  {
    slug: 'aventura-espacial',
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
  },
  {
    slug: 'valle-de-los-dinosaurios',
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
  },
  {
    slug: 'reino-encantado',
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
  },
  {
    slug: 'gol-de-campeon',
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
  },
  {
    slug: 'superheroe-por-un-dia',
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
  },
  {
    slug: 'amigos-de-la-selva',
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
  },
  {
    slug: 'secreto-del-fondo-del-mar',
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
  },
  {
    slug: 'cartoon-3d',
    active: true,
    order: 2,
    name: { es: 'Cartoon 3D', en: '3D cartoon', pt: 'Cartoon 3D' },
    promptModifier: '3D animated movie style, soft lighting, rounded shapes, vibrant colors',
    sampleImage: '/styles/cartoon-3d.webp',
  },
  {
    slug: 'cuento-clasico',
    active: true,
    order: 3,
    name: { es: 'Cuento clásico', en: 'Classic storybook', pt: 'Conto clássico' },
    promptModifier: 'classic storybook illustration, ink lines and gouache, warm vintage tones',
    sampleImage: '/styles/cuento-clasico.webp',
  },
  {
    slug: 'lapices-de-colores',
    active: true,
    order: 4,
    name: { es: 'Lápices de colores', en: 'Colored pencils', pt: 'Lápis de cor' },
    promptModifier: 'colored pencil drawing, hand-drawn texture, cheerful and simple',
    sampleImage: '/styles/lapices-de-colores.webp',
  },
];
