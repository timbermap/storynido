/**
 * Colecciones por línea comercial (docs/estrategia/LINEAS-COMERCIALES.md §7).
 * Se editan desde el admin (fase 14); esto es el punto de partida.
 */
import type { Collection } from '@storynido/shared';

type SeedCollection = Omit<Collection, 'createdAt' | 'updatedAt'>;

const t = (es: string, en: string, pt: string) => ({ es, en, pt });

export const SEED_COLLECTIONS: SeedCollection[] = [
  // --- Familias -------------------------------------------------------------
  {
    slug: 'aventuras',
    active: true,
    order: 1,
    channel: 'families',
    name: t('Aventuras', 'Adventures', 'Aventuras'),
    description: t(
      'Viajes al espacio, dinosaurios y reinos mágicos donde su hijo es el héroe.',
      'Space trips, dinosaurs and magical kingdoms where your child is the hero.',
      'Viagens ao espaço, dinossauros e reinos mágicos onde seu filho é o herói.',
    ),
    topics: [],
  },
  {
    slug: 'nuestros-recuerdos',
    active: true,
    order: 2,
    channel: 'families',
    name: t('Nuestros recuerdos', 'Our Memories', 'Nossas lembranças'),
    description: t(
      'Historias hechas con los recuerdos reales de la familia: los abuelos, la mascota, los hermanos.',
      "Stories made from your family's real memories: grandparents, pets, siblings.",
      'Histórias feitas com as lembranças reais da família: os avós, o bichinho, os irmãos.',
    ),
    topics: [],
  },
  {
    slug: 'grandes-momentos',
    active: true,
    order: 3,
    channel: 'families',
    name: t('Grandes momentos', 'Big Moments', 'Grandes momentos'),
    description: t(
      'Para acompañar los cambios: el primer día de clases, la llegada de un hermano, una mudanza.',
      'For life changes: the first day of school, a new sibling, a move.',
      'Para acompanhar as mudanças: o primeiro dia de aula, a chegada de um irmão, uma mudança de casa.',
    ),
    topics: [],
  },
  // --- Eventos --------------------------------------------------------------
  {
    slug: 'cumpleanos',
    active: true,
    order: 10,
    channel: 'events',
    name: t('Fiestas mágicas', 'Magical parties', 'Festas mágicas'),
    description: t(
      'Cuentos de cumpleaños con el protagonista de la fiesta, para regalar a cada invitado.',
      'Birthday stories starring the guest of honor, to give to every guest.',
      'Histórias de aniversário com o protagonista da festa, para presentear cada convidado.',
    ),
    topics: [],
  },
  {
    slug: 'cumple-superheroes',
    active: true,
    order: 11,
    channel: 'events',
    name: t('Superhéroes y heroínas', 'Superheroes and heroines', 'Super-heróis e heroínas'),
    description: t(
      'El cumpleañero (o la cumpleañera) con capa y superpoderes, para repartir entre los invitados.',
      'The birthday hero with a cape and superpowers, to hand out to every guest.',
      'O aniversariante com capa e superpoderes, para entregar a cada convidado.',
    ),
    topics: [],
  },
  {
    slug: 'cumple-ciencia-espacio',
    active: true,
    order: 12,
    channel: 'events',
    name: t('Ciencia y espacio', 'Science & space', 'Ciência e espaço'),
    description: t(
      'Astronautas, exploradores e inventores: una fiesta para los más curiosos.',
      'Astronauts, explorers and inventors: a party for the most curious.',
      'Astronautas, exploradores e inventores: uma festa para os mais curiosos.',
    ),
    topics: [],
  },
  {
    slug: 'cumple-fantasia',
    active: true,
    order: 13,
    channel: 'events',
    name: t('Fantasía y reinos', 'Fantasy & kingdoms', 'Fantasia e reinos'),
    description: t(
      'Reinos mágicos, princesas, caballeros y criaturas encantadas.',
      'Magical kingdoms, princesses, knights and enchanted creatures.',
      'Reinos mágicos, princesas, cavaleiros e criaturas encantadas.',
    ),
    topics: [],
  },
  {
    slug: 'cumple-animales',
    active: true,
    order: 14,
    channel: 'events',
    name: t('Animales y aventuras', 'Animals & adventures', 'Animais e aventuras'),
    description: t(
      'Dinosaurios, selva y fondo del mar: una fiesta salvaje.',
      'Dinosaurs, jungle and deep sea: a wild party.',
      'Dinossauros, selva e fundo do mar: uma festa selvagem.',
    ),
    topics: [],
  },
  {
    slug: 'cumple-campeones',
    active: true,
    order: 15,
    channel: 'events',
    name: t('Campeones', 'Champions', 'Campeões'),
    description: t(
      'Para quienes viven el deporte: goles, medallas y trabajo en equipo.',
      'For those who live for sport: goals, medals and teamwork.',
      'Para quem vive o esporte: gols, medalhas e trabalho em equipe.',
    ),
    topics: [],
  },
  // --- Profesionales --------------------------------------------------------
  {
    slug: 'que-lindo-es-aprender',
    active: true,
    order: 20,
    channel: 'professionals',
    name: t('¡Qué lindo es aprender!', 'Learning Is Wonderful!', 'Que lindo é aprender!'),
    description: t(
      'Cuentos que despiertan las ganas de leer, contar y preguntar.',
      'Stories that spark the wish to read, count and ask.',
      'Histórias que despertam a vontade de ler, contar e perguntar.',
    ),
    topics: [
      t('Lectura', 'Reading', 'Leitura'),
      t('Letras', 'Letters', 'Letras'),
      t('Números', 'Numbers', 'Números'),
      t('Curiosidad', 'Curiosity', 'Curiosidade'),
      t('Hábitos de estudio', 'Study habits', 'Hábitos de estudo'),
    ],
  },
  {
    slug: 'conozco-mis-emociones',
    active: true,
    order: 21,
    channel: 'professionals',
    name: t('Conozco mis emociones', 'I Know My Feelings', 'Conheço minhas emoções'),
    description: t(
      'Para reconocer lo que se siente y encontrar palabras para contarlo.',
      'To recognize feelings and find the words to share them.',
      'Para reconhecer o que se sente e encontrar palavras para contar.',
    ),
    topics: [
      t('Reconocer emociones', 'Recognizing feelings', 'Reconhecer emoções'),
      t('Expresar necesidades', 'Expressing needs', 'Expressar necessidades'),
      t('Cambios cotidianos', 'Everyday changes', 'Mudanças do dia a dia'),
      t('Vínculos', 'Relationships', 'Vínculos'),
    ],
  },
  {
    slug: 'mis-pequenos-logros',
    active: true,
    order: 22,
    channel: 'professionals',
    name: t('Mis pequeños logros', 'My Little Wins', 'Minhas pequenas conquistas'),
    description: t(
      'Historias que celebran el esfuerzo y cada paso hacia adelante.',
      'Stories that celebrate effort and every step forward.',
      'Histórias que celebram o esforço e cada passo adiante.',
    ),
    topics: [
      t('Perseverancia', 'Perseverance', 'Perseverança'),
      t('Aprender nuevas habilidades', 'Learning new skills', 'Aprender novas habilidades'),
      t('Pedir ayuda', 'Asking for help', 'Pedir ajuda'),
      t('Reconocer progresos', 'Recognizing progress', 'Reconhecer progressos'),
    ],
  },
  {
    slug: 'mi-primera-experiencia',
    active: true,
    order: 23,
    channel: 'professionals',
    name: t('Mi primera experiencia', 'My First Time', 'Minha primeira experiência'),
    description: t(
      'Para anticipar situaciones nuevas y llegar con confianza.',
      'To prepare for new situations and arrive with confidence.',
      'Para antecipar situações novas e chegar com confiança.',
    ),
    topics: [
      t('Visita al dentista', 'Visiting the dentist', 'Visita ao dentista'),
      t('Primer día de clases', 'First day of school', 'Primeiro dia de aula'),
      t('Nuevas situaciones', 'New situations', 'Situações novas'),
    ],
  },
];
