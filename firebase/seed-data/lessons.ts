/**
 * Enseñanzas de lanzamiento: se combinan con cualquier aventura.
 * Los temas sensibles (pérdidas, separaciones) quedan fuera hasta tener revisión humana.
 */
import type { Lesson } from '@storynido/shared';

type SeedLesson = Omit<Lesson, 'createdAt' | 'updatedAt' | 'active' | 'sensitive'>;

const BASE =
  'Integrate the message naturally into the plot through what the hero does and feels; never lecture or state a moral at the end. Keep it warm, age-appropriate and hopeful.';

export const SEED_LESSONS: SeedLesson[] = [
  // --- Valores
  {
    slug: 'compartir',
    order: 1,
    group: 'values',
    ageMin: 2,
    ageMax: 8,
    name: { es: 'Compartir', en: 'Sharing', pt: 'Compartilhar' },
    headline: {
      es: 'Un cuento para descubrir que compartir es más divertido',
      en: 'A story to discover that sharing is more fun',
      pt: 'Uma história para descobrir que compartilhar é mais divertido',
    },
    description: {
      es: 'Tu hijo descubre en su aventura que lo que se comparte se disfruta el doble.',
      en: 'In their adventure, your child discovers that what you share you enjoy twice as much.',
      pt: 'Na aventura, seu filho descobre que o que se compartilha se aproveita em dobro.',
    },
    promptGuidance: `${BASE} Theme: sharing. The hero hesitates to share something special, shares it, and the adventure becomes better for everyone.`,
  },
  {
    slug: 'amistad',
    order: 2,
    group: 'values',
    ageMin: 3,
    ageMax: 10,
    name: { es: 'La amistad', en: 'Friendship', pt: 'A amizade' },
    headline: {
      es: 'Un cuento sobre el valor de los buenos amigos',
      en: 'A story about the value of good friends',
      pt: 'Uma história sobre o valor dos bons amigos',
    },
    description: {
      es: 'Una aventura que celebra hacer amigos, ayudarse y estar juntos.',
      en: 'An adventure that celebrates making friends, helping each other and being together.',
      pt: 'Uma aventura que celebra fazer amigos, ajudar uns aos outros e estar juntos.',
    },
    promptGuidance: `${BASE} Theme: friendship. The hero makes a new friend or helps a friend, and together they overcome a challenge.`,
  },
  {
    slug: 'respetar-las-diferencias',
    order: 3,
    group: 'values',
    ageMin: 4,
    ageMax: 12,
    name: {
      es: 'Respetar las diferencias',
      en: 'Embracing differences',
      pt: 'Respeitar as diferenças',
    },
    headline: {
      es: 'Un cuento para celebrar que todos somos distintos',
      en: 'A story to celebrate that we are all different',
      pt: 'Uma história para celebrar que todos somos diferentes',
    },
    description: {
      es: 'Tu hijo conoce personajes muy distintos a él y descubre lo valioso de cada uno.',
      en: 'Your child meets characters very different from them and discovers what makes each one special.',
      pt: 'Seu filho conhece personagens muito diferentes dele e descobre o valor de cada um.',
    },
    promptGuidance: `${BASE} Theme: respecting differences and inclusion. Characters with different looks, abilities or ways of being each contribute something unique to solve the challenge.`,
  },
  {
    slug: 'cuidar-la-naturaleza',
    order: 4,
    group: 'values',
    ageMin: 3,
    ageMax: 12,
    name: { es: 'Cuidar la naturaleza', en: 'Caring for nature', pt: 'Cuidar da natureza' },
    headline: {
      es: 'Un cuento para aprender a cuidar el planeta',
      en: 'A story to learn how to care for our planet',
      pt: 'Uma história para aprender a cuidar do planeta',
    },
    description: {
      es: 'Una aventura donde cuidar plantas, animales y el agua salva el día.',
      en: 'An adventure where caring for plants, animals and water saves the day.',
      pt: 'Uma aventura em que cuidar das plantas, dos animais e da água salva o dia.',
    },
    promptGuidance: `${BASE} Theme: caring for nature. Small concrete actions by the hero (cleaning, protecting animals, saving water) restore a place in the story.`,
  },
  {
    slug: 'decir-la-verdad',
    order: 5,
    group: 'values',
    ageMin: 3,
    ageMax: 10,
    name: { es: 'Decir la verdad', en: 'Telling the truth', pt: 'Falar a verdade' },
    headline: {
      es: 'Un cuento sobre la valentía de decir la verdad',
      en: 'A story about the courage to tell the truth',
      pt: 'Uma história sobre a coragem de falar a verdade',
    },
    description: {
      es: 'Tu hijo comete un error en su aventura y descubre que decir la verdad lo hace más fuerte.',
      en: 'Your child makes a mistake in their adventure and discovers that telling the truth makes them stronger.',
      pt: 'Seu filho comete um erro na aventura e descobre que falar a verdade o deixa mais forte.',
    },
    promptGuidance: `${BASE} Theme: honesty. The hero makes a small mistake, feels tempted to hide it, tells the truth and is met with understanding.`,
  },
  // --- Confianza
  {
    slug: 'lograr-lo-que-te-propongas',
    order: 6,
    group: 'confidence',
    ageMin: 4,
    ageMax: 12,
    name: {
      es: 'Puedes lograr lo que te propongas',
      en: 'You can achieve anything you set your mind to',
      pt: 'Você pode conseguir o que quiser',
    },
    headline: {
      es: 'Un cuento para que sepa que puede lograr lo que se proponga',
      en: 'A story to show them they can achieve anything they set their mind to',
      pt: 'Uma história para mostrar que ele pode conseguir tudo o que quiser',
    },
    description: {
      es: 'Con esfuerzo, práctica y ganas, tu hijo alcanza una meta que parecía imposible.',
      en: 'With effort, practice and determination, your child reaches a goal that seemed impossible.',
      pt: 'Com esforço, prática e vontade, seu filho alcança uma meta que parecia impossível.',
    },
    promptGuidance: `${BASE} Theme: perseverance and self-belief. The hero tries, fails, practices and finally succeeds; celebrate effort over talent.`,
  },
  {
    slug: 'valentia',
    order: 7,
    group: 'confidence',
    ageMin: 3,
    ageMax: 10,
    name: { es: 'La valentía', en: 'Being brave', pt: 'A coragem' },
    headline: {
      es: 'Un cuento para vencer los miedos',
      en: 'A story to overcome fears',
      pt: 'Uma história para vencer os medos',
    },
    description: {
      es: 'Tu hijo descubre que ser valiente no es no tener miedo, sino animarse igual.',
      en: "Your child discovers that being brave isn't about not being scared, but about trying anyway.",
      pt: 'Seu filho descobre que ser corajoso não é não ter medo, e sim se animar mesmo assim.',
    },
    promptGuidance: `${BASE} Theme: courage. The hero feels afraid (never terrifying imagery), takes a small brave step with support, and discovers their own strength.`,
  },
  {
    slug: 'equivocarse-esta-bien',
    order: 8,
    group: 'confidence',
    ageMin: 3,
    ageMax: 10,
    name: { es: 'Está bien equivocarse', en: "It's okay to make mistakes", pt: 'Tudo bem errar' },
    headline: {
      es: 'Un cuento para aprender que equivocarse es parte de aprender',
      en: 'A story to learn that mistakes are part of learning',
      pt: 'Uma história para aprender que errar faz parte de aprender',
    },
    description: {
      es: 'En su aventura, cada error lleva a tu hijo a una idea mejor.',
      en: 'In their adventure, every mistake leads your child to a better idea.',
      pt: 'Na aventura, cada erro leva seu filho a uma ideia melhor.',
    },
    promptGuidance: `${BASE} Theme: mistakes as learning. A mistake by the hero leads to a creative solution; adults and friends respond kindly.`,
  },
  {
    slug: 'ser-uno-mismo',
    order: 9,
    group: 'confidence',
    ageMin: 4,
    ageMax: 12,
    name: { es: 'Ser uno mismo', en: 'Being yourself', pt: 'Ser você mesmo' },
    headline: {
      es: 'Un cuento para quererse tal como es',
      en: 'A story to love themselves just as they are',
      pt: 'Uma história para se amar do jeito que é',
    },
    description: {
      es: 'Lo que hace único a tu hijo es justo lo que salva la aventura.',
      en: 'What makes your child unique is exactly what saves the adventure.',
      pt: 'O que torna seu filho único é justamente o que salva a aventura.',
    },
    promptGuidance: `${BASE} Theme: self-acceptance. A trait or interest of the hero (from their likes) turns out to be the key to the adventure.`,
  },
  // --- Momentos de la vida
  {
    slug: 'llega-un-hermanito',
    order: 10,
    group: 'life',
    ageMin: 2,
    ageMax: 8,
    name: { es: 'Llega un hermanito', en: 'A new sibling', pt: 'Chegou um irmãozinho' },
    headline: {
      es: 'Un cuento para recibir a su hermanito',
      en: 'A story to welcome a new baby brother or sister',
      pt: 'Uma história para receber o irmãozinho',
    },
    description: {
      es: 'Tu hijo descubre que en su aventura, y en el corazón de la familia, hay lugar para todos.',
      en: "Your child discovers that in their adventure, and in the family's heart, there's room for everyone.",
      pt: 'Seu filho descobre que na aventura, e no coração da família, há lugar para todos.',
    },
    promptGuidance: `${BASE} Theme: welcoming a new sibling. The hero becomes a proud big brother/sister; acknowledge mixed feelings gently and reassure them they are still loved just as much.`,
  },
  {
    slug: 'primer-dia-de-clases',
    order: 11,
    group: 'life',
    ageMin: 3,
    ageMax: 7,
    name: { es: 'Primer día de clases', en: 'First day of school', pt: 'Primeiro dia de aula' },
    headline: {
      es: 'Un cuento para el primer día de clases',
      en: 'A story for the first day of school',
      pt: 'Uma história para o primeiro dia de aula',
    },
    description: {
      es: 'Nervios, mochila nueva y muchos amigos por conocer: una aventura para empezar con confianza.',
      en: 'Butterflies, a new backpack and many friends to meet: an adventure to start with confidence.',
      pt: 'Frio na barriga, mochila nova e muitos amigos para conhecer: uma aventura para começar com confiança.',
    },
    promptGuidance: `${BASE} Theme: starting school. The adventure mirrors a first day: nerves, a kind welcome, a new friend, and the joy of returning home with stories to tell.`,
  },
  {
    slug: 'dormir-solo',
    order: 12,
    group: 'life',
    ageMin: 2,
    ageMax: 7,
    name: { es: 'Dormir solo', en: 'Sleeping on their own', pt: 'Dormir sozinho' },
    headline: {
      es: 'Un cuento para animarse a dormir solo',
      en: 'A story to feel brave sleeping on their own',
      pt: 'Uma história para se animar a dormir sozinho',
    },
    description: {
      es: 'Una aventura que termina en su propia cama, con calma y sin miedo a la noche.',
      en: 'An adventure that ends in their own bed, calm and unafraid of the night.',
      pt: 'Uma aventura que termina na própria cama, com calma e sem medo da noite.',
    },
    promptGuidance: `${BASE} Theme: sleeping alone. Night is friendly and calm; the hero discovers their room is a safe, cozy place. End softly, suitable for bedtime.`,
  },
  {
    slug: 'dejar-el-panal-o-el-chupete',
    order: 13,
    group: 'life',
    ageMin: 2,
    ageMax: 5,
    name: {
      es: 'Dejar el pañal o el chupete',
      en: 'Saying goodbye to diapers or the pacifier',
      pt: 'Largar a fralda ou a chupeta',
    },
    headline: {
      es: 'Un cuento para despedirse del pañal o del chupete',
      en: 'A story to say goodbye to diapers or the pacifier',
      pt: 'Uma história para se despedir da fralda ou da chupeta',
    },
    description: {
      es: 'Tu hijo se siente grande y orgulloso al dar este paso.',
      en: 'Your child feels big and proud taking this step.',
      pt: 'Seu filho se sente grande e orgulhoso ao dar esse passo.',
    },
    promptGuidance: `${BASE} Theme: a toddler milestone (leaving diapers or the pacifier). Celebrate growing up with pride; never shame. Keep language very simple.`,
  },
  {
    slug: 'mudanza',
    order: 14,
    group: 'life',
    ageMin: 3,
    ageMax: 10,
    name: { es: 'Mudarse de casa', en: 'Moving to a new home', pt: 'Mudar de casa' },
    headline: {
      es: 'Un cuento para empezar en una casa nueva',
      en: 'A story for starting in a new home',
      pt: 'Uma história para começar em uma casa nova',
    },
    description: {
      es: 'Tu hijo descubre que el hogar es donde está su familia y que lo nuevo trae aventuras.',
      en: 'Your child discovers that home is where their family is and that new places bring adventures.',
      pt: 'Seu filho descobre que lar é onde está a família e que o novo traz aventuras.',
    },
    promptGuidance: `${BASE} Theme: moving home. Honor what they leave behind, then discover the excitement of a new place and new friends.`,
  },
  // --- Emociones
  {
    slug: 'manejar-el-enojo',
    order: 15,
    group: 'emotions',
    ageMin: 3,
    ageMax: 10,
    name: { es: 'Manejar el enojo', en: 'Handling anger', pt: 'Lidar com a raiva' },
    headline: {
      es: 'Un cuento para entender y calmar el enojo',
      en: 'A story to understand and calm anger',
      pt: 'Uma história para entender e acalmar a raiva',
    },
    description: {
      es: 'Tu hijo aprende a reconocer el enojo y encuentra formas de calmarse.',
      en: 'Your child learns to recognize anger and finds ways to calm down.',
      pt: 'Seu filho aprende a reconhecer a raiva e encontra jeitos de se acalmar.',
    },
    promptGuidance: `${BASE} Theme: emotional regulation (anger). Name the feeling, show a simple calming strategy (breathing, counting, asking for help), and repair afterwards.`,
  },
  {
    slug: 'calma-cuando-estoy-nervioso',
    order: 16,
    group: 'emotions',
    ageMin: 3,
    ageMax: 10,
    name: {
      es: 'Calma cuando estoy nervioso',
      en: 'Feeling calm when nervous',
      pt: 'Calma quando estou nervoso',
    },
    headline: {
      es: 'Un cuento para encontrar la calma',
      en: 'A story to find calm',
      pt: 'Uma história para encontrar a calma',
    },
    description: {
      es: 'Una aventura con trucos sencillos para tranquilizarse cuando algo da nervios.',
      en: 'An adventure with simple tricks to feel calm when something feels scary or new.',
      pt: 'Uma aventura com truques simples para se acalmar quando algo dá nervoso.',
    },
    promptGuidance: `${BASE} Theme: managing nerves and anxiety. The hero learns a gentle calming routine (deep breaths, a comforting object, positive words) and uses it to face the challenge.`,
  },
];
