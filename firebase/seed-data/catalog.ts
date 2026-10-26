/**
 * Catálogo de ejemplo: 6 historias y 4 estilos en los tres idiomas.
 * Es el punto de partida; después se edita desde el panel admin (fase 14).
 */
import type { IllustrationStyle, Story } from '@storynido/shared';

type SeedStory = Omit<Story, 'createdAt' | 'updatedAt'>;
type SeedStyle = Omit<IllustrationStyle, 'createdAt' | 'updatedAt'>;

const TEXT_PROMPT = `Escribí un cuento infantil en {{language}} de {{pageCount}} páginas sobre "{{storyTitle}}".
Protagonista: {{childName}}, {{age}} años ({{pronouns}}). Le gusta: {{likes}}.
Mascota: {{petName}}. Mejor amigo/a: {{bestFriendName}}.
Tono cálido, frases cortas adecuadas a la edad, sin violencia ni miedo. Cada página: 2 a 4 oraciones y una descripción de la escena para ilustrar.`;

const IMAGE_PROMPT = `Ilustración de libro infantil: {{scene}}. Protagonista: {{character}}. Estilo: {{style}}. Composición clara, colores cálidos, sin texto en la imagen.`;

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
    coverImage: '/samples/aventura-espacial.svg',
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
    coverImage: '/samples/valle-de-los-dinosaurios.svg',
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
    coverImage: '/samples/reino-encantado.svg',
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
    coverImage: '/samples/gol-de-campeon.svg',
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
    coverImage: '/samples/superheroe-por-un-dia.svg',
    samplePages: [],
    textPromptTemplate: TEXT_PROMPT,
    imagePromptTemplate: IMAGE_PROMPT,
  },
  {
    slug: 'primer-dia-de-clases',
    active: true,
    order: 6,
    ageMin: 3,
    ageMax: 6,
    tags: ['escuela', 'emociones'],
    pageCount: 12,
    title: {
      es: 'Mi primer día de clases',
      en: 'My First Day of School',
      pt: 'Meu primeiro dia de aula',
    },
    summary: {
      es: 'Mochila nueva, nervios y muchas preguntas. Un cuento para acompañar el primer día de escuela y transformar los miedos en ganas de aprender y hacer amigos.',
      en: 'A new backpack, butterflies in the tummy, and lots of questions. A story to accompany the first day of school and turn fears into excitement for learning and making friends.',
      pt: 'Mochila nova, frio na barriga e muitas perguntas. Um conto para acompanhar o primeiro dia de aula e transformar o medo em vontade de aprender e fazer amigos.',
    },
    excerpt: {
      es: 'En la puerta de la escuela, Emma apretó fuerte la mano de mamá. Entonces vio a una nena con una mochila de dinosaurios, igual que la suya. —¿Quieres ser mi amiga? —le preguntó.',
      en: 'At the school door, Emma squeezed Mom\'s hand. Then she saw a girl with a dinosaur backpack, just like hers. "Do you want to be my friend?" she asked.',
      pt: 'Na porta da escola, Emma apertou forte a mão da mamãe. Então viu uma menina com uma mochila de dinossauros, igualzinha à dela. — Quer ser minha amiga? — perguntou.',
    },
    coverImage: '/samples/primer-dia-de-clases.svg',
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
    sampleImage: null,
  },
  {
    slug: 'cartoon-3d',
    active: true,
    order: 2,
    name: { es: 'Cartoon 3D', en: '3D cartoon', pt: 'Cartoon 3D' },
    promptModifier: '3D animated movie style, soft lighting, rounded shapes, vibrant colors',
    sampleImage: null,
  },
  {
    slug: 'cuento-clasico',
    active: true,
    order: 3,
    name: { es: 'Cuento clásico', en: 'Classic storybook', pt: 'Conto clássico' },
    promptModifier: 'classic storybook illustration, ink lines and gouache, warm vintage tones',
    sampleImage: null,
  },
  {
    slug: 'lapices-de-colores',
    active: true,
    order: 4,
    name: { es: 'Lápices de colores', en: 'Colored pencils', pt: 'Lápis de cor' },
    promptModifier: 'colored pencil drawing, hand-drawn texture, cheerful and simple',
    sampleImage: null,
  },
];
