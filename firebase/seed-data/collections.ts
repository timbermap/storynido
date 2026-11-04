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
  {
    slug: 'grandes-lectores',
    active: true,
    order: 4,
    channel: 'families',
    name: t('Para grandes lectores', 'For Big Readers', 'Para grandes leitores'),
    description: t(
      'Misterios, inventos y expediciones con tramas más largas, para chicos de 9 a 12 años.',
      'Mysteries, inventions and expeditions with longer plots, for kids aged 9 to 12.',
      'Mistérios, invenções e expedições com tramas mais longas, para crianças de 9 a 12 anos.',
    ),
    topics: [],
  },
  // --- Eventos --------------------------------------------------------------
  {
    slug: 'cumpleanos',
    active: true,
    order: 10,
    channel: 'events',
    name: t('El clásico de cumpleaños', 'The classic birthday', 'O aniversário clássico'),
    description: t(
      'Cuentos de cumpleaños con el protagonista de la fiesta, para regalar a cada invitado.',
      'Birthday stories starring the guest of honor, to give to every guest.',
      'Histórias de aniversário com o protagonista da festa, para presentear cada convidado.',
    ),
    topics: [
      t('Pastel y velas', 'Cake and candles', 'Bolo e velas'),
      t('Globos', 'Balloons', 'Balões'),
      t('Deseos', 'Wishes', 'Desejos'),
    ],
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
    topics: [
      t('Capas y superpoderes', 'Capes and superpowers', 'Capas e superpoderes'),
      t('Salvar la ciudad', 'Saving the city', 'Salvar a cidade'),
      t('Héroes y heroínas', 'Heroes and heroines', 'Heróis e heroínas'),
    ],
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
    topics: [
      t('Astronautas', 'Astronauts', 'Astronautas'),
      t('Científicas e inventores', 'Scientists and inventors', 'Cientistas e inventores'),
      t('Robots', 'Robots', 'Robôs'),
      t('Planetas', 'Planets', 'Planetas'),
    ],
  },
  {
    slug: 'cumple-fantasia',
    active: true,
    order: 13,
    channel: 'events',
    name: t(
      'Princesas, caballeros y dragones',
      'Princesses, knights and dragons',
      'Princesas, cavaleiros e dragões',
    ),
    description: t(
      'Reinos mágicos, princesas, caballeros y criaturas encantadas.',
      'Magical kingdoms, princesses, knights and enchanted creatures.',
      'Reinos mágicos, princesas, cavaleiros e criaturas encantadas.',
    ),
    topics: [
      t('Princesas', 'Princesses', 'Princesas'),
      t('Caballeros', 'Knights', 'Cavaleiros'),
      t('Dragones', 'Dragons', 'Dragões'),
      t('Castillos', 'Castles', 'Castelos'),
      t('Unicornios', 'Unicorns', 'Unicórnios'),
    ],
  },
  {
    slug: 'cumple-animales',
    active: true,
    order: 14,
    channel: 'events',
    name: t('Dinosaurios y animales', 'Dinosaurs and animals', 'Dinossauros e animais'),
    description: t(
      'Dinosaurios, selva y fondo del mar: una fiesta salvaje.',
      'Dinosaurs, jungle and deep sea: a wild party.',
      'Dinossauros, selva e fundo do mar: uma festa selvagem.',
    ),
    topics: [
      t('Dinosaurios', 'Dinosaurs', 'Dinossauros'),
      t('Safari y selva', 'Safari and jungle', 'Safári e selva'),
      t('Fondo del mar', 'Under the sea', 'Fundo do mar'),
    ],
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
    topics: [
      t('Fútbol', 'Soccer', 'Futebol'),
      t('Básquet', 'Basketball', 'Basquete'),
      t('Béisbol', 'Baseball', 'Beisebol'),
      t('Carreras', 'Racing', 'Corridas'),
    ],
  },
  // Ocasiones (no son temáticas de cumpleaños): la tarjeta abre el creador con la ocasión.
  {
    slug: 'primera-comunion',
    active: true,
    order: 30,
    channel: 'events',
    name: t('Mi primera comunión', 'My First Communion', 'Minha primeira comunhão'),
    description: t(
      'Un recuerdo para cada invitado, con tu hijo o tu hija como protagonista del día.',
      'A keepsake for every guest, with your child as the star of the day.',
      'Uma lembrança para cada convidado, com seu filho ou sua filha como protagonista do dia.',
    ),
    topics: [
      t('Vela y rosario', 'Candle and rosary', 'Vela e terço'),
      t('Familia y padrinos', 'Family and godparents', 'Família e padrinhos'),
      t('Compartir', 'Sharing', 'Partilhar'),
    ],
    eventType: 'communion',
  },
  {
    slug: 'graduacion',
    active: true,
    order: 31,
    channel: 'events',
    name: t('Mi graduación', 'My Graduation', 'Minha formatura'),
    description: t(
      'Kínder, jardín o primaria: un librito para cada compañero, para cerrar el año juntos.',
      'Preschool, kindergarten or elementary school: a little book for every classmate to close the year together.',
      'Educação infantil ou ensino fundamental: um livrinho para cada colega, para fechar o ano juntos.',
    ),
    topics: [
      t('Kínder y jardín', 'Kindergarten and preschool', 'Educação infantil'),
      t('Primaria', 'Elementary school', 'Ensino fundamental'),
      t('Fin de año', 'End of the school year', 'Fim de ano'),
    ],
    eventType: 'graduation',
  },
  // --- Profesionales --------------------------------------------------------
  {
    slug: 'que-lindo-es-aprender',
    active: true,
    order: 20,
    channel: 'professionals',
    name: t(
      'Motivar la lectura y la curiosidad',
      'Encouraging reading and curiosity',
      'Incentivar a leitura e a curiosidade',
    ),
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
    name: t(
      'Reconocer y expresar emociones',
      'Recognizing and expressing feelings',
      'Reconhecer e expressar emoções',
    ),
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
    name: t(
      'Manejar la frustración y no rendirse',
      'Handling frustration and not giving up',
      'Lidar com a frustração e não desistir',
    ),
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
    slug: 'calmarme-y-regularme',
    active: true,
    order: 24,
    channel: 'professionals',
    name: t('Calmarme y regularme', 'Calming down and self-regulation', 'Acalmar-se e se regular'),
    description: t(
      'Historias para parar, respirar y encontrar qué ayuda cuando todo es demasiado.',
      'Stories to pause, breathe and find what helps when everything is too much.',
      'Histórias para parar, respirar e encontrar o que ajuda quando tudo é demais.',
    ),
    topics: [
      t('Respiración', 'Breathing', 'Respiração'),
      t('Rincón de la calma', 'Calm-down corner', 'Cantinho da calma'),
      t('Termómetro de emociones', 'Feelings thermometer', 'Termômetro de emoções'),
      t('Sobrecarga sensorial', 'Sensory overload', 'Sobrecarga sensorial'),
    ],
  },
  {
    slug: 'historias-sociales',
    active: true,
    order: 25,
    channel: 'professionals',
    name: t(
      'Historias sociales para el día a día',
      'Social stories for everyday life',
      'Histórias sociais para o dia a dia',
    ),
    description: t(
      'Frases cortas y en orden, para anticipar rutinas, cambios y lugares nuevos.',
      'Short sentences in order, to prepare for routines, changes and new places.',
      'Frases curtas e em ordem, para antecipar rotinas, mudanças e lugares novos.',
    ),
    topics: [
      t('Cambios de plan', 'Changes of plan', 'Mudanças de plano'),
      t('Lugares nuevos', 'New places', 'Lugares novos'),
      t('Ruidos fuertes', 'Loud noises', 'Barulhos fortes'),
      t('Rutinas', 'Routines', 'Rotinas'),
    ],
  },
  {
    slug: 'mi-primera-experiencia',
    active: true,
    order: 23,
    channel: 'professionals',
    name: t('Anticipar lo que viene', 'Getting ready for what comes next', 'Antecipar o que vem'),
    description: t(
      'Para anticipar situaciones nuevas y llegar con confianza.',
      'To prepare for new situations and arrive with confidence.',
      'Para antecipar situações novas e chegar com confiança.',
    ),
    topics: [
      t('Visita al dentista', 'Visiting the dentist', 'Visita ao dentista'),
      t('Visita al médico', 'Visiting the doctor', 'Visita ao médico'),
      t('Primer día de clases', 'First day of school', 'Primeiro dia de aula'),
      t('Nuevas situaciones', 'New situations', 'Situações novas'),
    ],
  },
];
