/**
 * Genera las imágenes de marca del paquete "Rediseño de imágenes" (DECISIONS 157): heroes,
 * secciones, portadas del catálogo y muestras de estilo, con los prompts de los archivos 01 a 04.
 * Las fotos son reemplazos con IA hasta tener las reales (prompts de respaldo del archivo 02).
 *
 *   pnpm --filter @storynido/providers exec tsx scripts/generate-brand-images.ts <salida/>           # estima
 *   ... <salida/> --yes [--only slug,slug] [--budget 4]                                               # genera (cuesta)
 *
 * Credenciales: token de gcloud con la configuración "storynido" (nunca la de Timbermap). Lo ya
 * generado en la carpeta de salida no se repite.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import sharp from 'sharp';

import { VERTEX_PRICES, VertexClient } from '../src/gcp/vertex';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    yes: { type: 'boolean', default: false },
    only: { type: 'string' },
    budget: { type: 'string', default: '4' },
  },
});
const OUT = path.resolve(positionals[0] ?? 'brand-images');

// --- Dirección de arte (archivo 01) -------------------------------------------------------------
const GOUACHE = `Gouache editorial children's picture-book illustration. Opaque matte paint with visible brush texture and subtle paper grain, bold simple shapes, confident outlines only where needed, slightly imperfect hand-made edges. Limited palette of 4-5 colors chosen from: navy, coral, terracotta, mustard, mint, lavender, cream. Simple background with one or two story elements and generous empty space. Even soft daylight, flat lighting. Characters with rounded proportions (head about one quarter of the body), friendly expressive faces, dot eyes with a small highlight.`;
const MINIMAL = `Minimal graphic children's book illustration. Flat shapes, clean even line, no texture except a very subtle paper grain, lots of white space, calm composition. Palette of 3-4 colors from: navy, lavender, mint, mustard, cream. Clear readable facial expressions, simple neutral clothing, no busy background.`;
const BLACKLIST = `Avoid: watercolor bleeds, soft pastel haze, glow, bloom, sparkles, glitter, fireflies, magic trails, bokeh, sunset gradients, lens flare, rim light, 3D render or Pixar look, plastic skin, hyper-detailed backgrounds, torn-paper borders, painted frames, text or letters, watermarks, extra fingers. NEVER draw color swatches, palette chips, hex codes, labels or captions anywhere in the image.`;

const BG: Record<string, string> = {
  navy: 'navy blue',
  coral: 'soft coral',
  mint: 'pale mint green',
  lavender: 'pale lavender',
  mustard: 'warm mustard yellow',
  cream: 'warm cream',
  // Bebés: color saturado (estudio de estilos, DECISIONS 158).
  yellowSat: 'saturated sunflower yellow',
  blueSat: 'saturated deep blue',
  turquoise: 'saturated turquoise',
  redSat: 'saturated warm red',
};

// --- Elenco (archivo 01) ------------------------------------------------------------------------
const CAST = {
  tomas:
    'Tomás, 5 (curly brown hair, round red glasses, light skin with rosy cheeks, blue-and-white striped sweater, green trousers)',
  martina: 'Martina, 6 (straight dark-brown bob with bangs, freckles, olive skin, coral sweater)',
  benja: 'Benja, 4 (short black coily hair, warm dark-brown skin, mustard t-shirt, red sneakers)',
  lola: 'Lola, 2 (light-brown hair in two tiny pigtails, fair skin, yellow overalls)',
  sofi: 'Sofi, 7 (long black braids, medium-brown skin, mint dress)',
  alex: 'Alex, 10 (short wavy black hair, light-brown skin, green hoodie)',
};
// El mismo chico a distintas edades (DECISIONS 158): mismos rasgos, proporción y ropa según la edad.
const KID = {
  tomas:
    'curly brown hair, round red glasses, light skin with rosy cheeks, blue-and-white striped sweater, green trousers',
  martina: 'straight dark-brown bob with bangs, freckles, olive skin, coral sweater',
  benja: 'short black coily hair, warm dark-brown skin, mustard t-shirt, red sneakers',
  sofi: 'long black braids, medium-brown skin, mint dress',
  lola: 'light-brown hair in two tiny pigtails, fair skin, yellow overalls',
  alex: 'short wavy black hair, light-brown skin, green hoodie',
};
const KID_NAME = {
  tomas: 'Tomás',
  martina: 'Martina',
  benja: 'Benja',
  sofi: 'Sofi',
  lola: 'Lola',
  alex: 'Alex',
};
const at = (name: keyof typeof KID, age: number) =>
  `${KID_NAME[name]}, ${String(age)} (${KID[name]})`;
// Por etapa: bebés saturado y simple, 6–8 historieta, 9+ novela gráfica.
const BABY = `Flat gouache or cut-paper picture-book illustration for babies. Saturated high-contrast colors (red, blue, turquoise, sunflower yellow), NO pastels, thick clear outlines, very simple shapes, a single main element on a plain saturated background, a large friendly face in the upper half. Toddler proportions (big head, short limbs). Matte opaque paint, slight hand-made texture.`;
const READER = `Gouache editorial children's illustration with comic-book energy. Opaque matte paint with visible brush texture, limited palette of navy, coral, mustard, mint. Taller proportions (head about one fifth of the body), diagonal dynamic composition, the child in motion, humor, hand-drawn motion lines, no text or lettering of any kind. Expressive faces with character.`;
const NOVEL = `Graphic-novel illustration for pre-teen readers. Firm black ink linework with flat color fills, deep navy and terracotta palette, realistic proportions (head about one sixth of the body), cinematic low-angle framing, suspense and intrigue. Nothing cute, nothing babyish, no rounded cartoon face.`;
const GENERIC = 'a child with short neutral brown hair and a plain t-shirt';

interface Job {
  file: string;
  aspect: '1:1' | '3:4' | '4:3';
  size: '1K' | '2K';
  /** Tamaño final (webp). */
  width: number;
  height: number;
  prompt: string;
  /** Archivos ya generados que se pasan como referencia (misma ilustración impresa, mismo elenco). */
  references?: string[];
}

const cover = (
  file: string,
  style: string,
  color: string,
  scene: string,
  generic = false,
): Job => ({
  file: `samples/${file}.webp`,
  aspect: '3:4',
  size: '1K',
  width: 1200,
  height: 1600,
  prompt: `${style}\nPicture-book cover illustration, portrait 3:4. Leave the top third as a plain flat area of ${BG[color]} with no elements (space for the title). ${scene}\nThe character fills 40-60% of the cover, looking at the viewer.${generic ? ' The character is generic, resembling nobody in particular.' : ''}\n${BLACKLIST}`,
});

const PHOTO = (body: string) =>
  `Candid real photograph, natural light, fine film grain, honest imperfect framing, off-center. ${body} No glow, no studio-perfect lighting, no text overlays.`;

const SCENE = `${CAST.tomas.replace('Tomás, 5', 'Tomás, 5')} sits under a tree reading a book, with a small fox curled up next to him. A few flowers in the grass. Landscape composition, character on the left third.`;
const style = (file: string, line: string): Job => ({
  file: `styles/${file}.webp`,
  aspect: '4:3',
  size: '1K',
  width: 800,
  height: 600,
  prompt: `${line}\n${SCENE}\nNo text, no letters, no swatches, no glow, no sparkles.`,
});

const JOBS: Job[] = [
  // ---- Ilustraciones base --------------------------------------------------------------------
  {
    file: 'secciones/personaje.webp',
    aspect: '1:1',
    size: '1K',
    width: 900,
    height: 900,
    prompt: `${GOUACHE}\nCharacter portrait of ${CAST.tomas}. Chest-up, three-quarter view, waving with a big natural smile, looking at the viewer. Plain cream background.\n${BLACKLIST}`,
  },
  {
    file: 'secciones/pagina-cohete.webp',
    aspect: '4:3',
    size: '1K',
    width: 1200,
    height: 900,
    prompt: `${GOUACHE}\nInterior picture-book page, landscape. ${CAST.tomas} flies a cardboard rocket with a painted number 5 over soft green hills at night. A big pale moon, one small house with a lit window, three simple stars. Navy sky, mustard and coral accents.\n${BLACKLIST}`,
  },
  {
    file: 'heroes/familias-pagina.webp',
    aspect: '3:4',
    size: '1K',
    width: 1200,
    height: 1500,
    prompt: `${GOUACHE}\nFull-page picture-book illustration, portrait. ${CAST.martina} stands proudly on top of a round green hill with her arms wide open, shouting with joy. Warm sand-colored sky, two simple cream clouds, a small kite far away. Lots of empty sky above her.\n${BLACKLIST}`,
  },
  {
    file: 'heroes/kit-base.webp',
    aspect: '3:4',
    size: '1K',
    width: 900,
    height: 1200,
    prompt: `${GOUACHE}\n${CAST.benja} wearing a coral party hat, holding a round birthday cake with 4 candles and grinning. A few flat confetti shapes in coral, mustard and mint around him. Plain cream background, centered, lots of space around.\n${BLACKLIST}`,
  },
  {
    file: 'heroes/pro-pagina.webp',
    aspect: '4:3',
    size: '1K',
    width: 1200,
    height: 900,
    prompt: `${MINIMAL}\nInterior page, landscape. A calm child with short neutral brown hair and a plain green t-shirt sits on a simple bed, looking up at a small grey rain cloud floating above their head; the child's hand reaches toward it. One window, one small plant. Lots of white space. Gentle, calm expression.\n${BLACKLIST}`,
  },
  // ---- Fotos (respaldo con IA hasta tener las reales) -----------------------------------------
  {
    file: 'heroes/home-transformacion.webp',
    aspect: '4:3',
    size: '2K',
    width: 1600,
    height: 1200,
    references: ['secciones/pagina-cohete.webp'],
    prompt: PHOTO(
      `35mm, f/2.8, Kodak Portra 400 tones. Light oak kitchen table, morning window light from the left, a coffee mug and crumbs. On the left a slightly bent real polaroid of a laughing 5-year-old boy with curly brown hair and round red glasses, pen note "Tomás, 5 años" on the border. On the right an open hardcover picture book, slightly worn, pages curving into the spine with real paper thickness and a soft gutter shadow; the right page shows the printed gouache illustration from the reference image (a boy in a cardboard rocket at night), following the page curve. No knitted blanket.`,
    ),
  },
  {
    file: 'heroes/familias-foto.webp',
    aspect: '1:1',
    size: '1K',
    width: 600,
    height: 600,
    prompt: PHOTO(
      `50mm. A 6-year-old girl with a straight dark-brown bob with bangs, freckles and a coral sweater, laughing and pointing to the side with her whole arm, mid-moment. Plain light wall background, slightly off-center. Natural skin texture, flyaway hairs, no retouching.`,
    ),
  },
  {
    file: 'secciones/foto-real.webp',
    aspect: '1:1',
    size: '1K',
    width: 900,
    height: 900,
    prompt: PHOTO(
      `50mm. A 5-year-old boy with curly brown hair, rosy cheeks and round red glasses, wearing a blue-and-white striped sweater, laughing at the camera, mid-moment, plain light wall background. Natural skin texture, flyaway hairs, no retouching.`,
    ),
  },
  ...(
    [
      [
        'kit-invitacion',
        'a printed birthday invitation card with "¡Estás invitado!" and a date, tied with coral ribbon',
      ],
      [
        'kit-cuento',
        'a stack of 6 identical mini picture books tied with coral ribbon and kraft paper name tags (Lucía, Mateo, Sofi)',
      ],
      ['kit-stickers', 'a sheet of round stickers with two or three peeled off'],
      ['kit-separadores', 'two printed bookmarks with tassels'],
    ] as const
  ).map(([file, piece]): Job => ({
    file: `heroes/${file}.webp`,
    aspect: '3:4',
    size: '1K',
    width: 900,
    height: 1200,
    references: ['heroes/kit-base.webp'],
    prompt: `Top-down real product photograph, plain warm white table, soft even daylight, fine grain, crisp real paper texture with slight curl and a soft shadow. ${piece}. Every printed piece shows the same flat gouache illustration of a smiling boy with black coily hair in a party hat holding a cake, as in the reference image. Scissors or a ribbon spool partly in frame. No balloons wall, no glitter, no bokeh, no text other than what is described.`,
  })),
  {
    file: 'heroes/pro-mesa.webp',
    aspect: '4:3',
    size: '2K',
    width: 1600,
    height: 1200,
    references: ['heroes/pro-pagina.webp'],
    prompt: `Overhead real photograph of a therapist's desk, light wood with some wear, soft natural light, fine grain, calm mood. An adult woman's hands with a simple ring and short natural nails hold open a children's picture book showing the minimal flat illustration from the reference image (a calm child with a small grey rain cloud above their head). Beside it a tablet with a simple list app, sticky notes, a mug of tea, colored pencils. No children or children's faces anywhere in the frame. Off-center framing, nothing staged-perfect. No text overlays.`,
  },
  // ---- Portadas Familias (Gouache editorial; archivo 03) --------------------------------------
  cover(
    'te-quiero-siempre',
    BABY,
    'yellowSat',
    `${at('lola', 2)} hugs the neck of an adult seen from behind (only shoulders, arms and hair visible), cheek on the shoulder, eyes closed, smiling. Three big flat red hearts.`,
  ),
  cover(
    'buenas-noches',
    BABY,
    'blueSat',
    `${at('lola', 2)} in blue pajamas yawning, holding a red bunny. One big flat yellow moon behind. No soft glow.`,
  ),
  cover(
    'amigos-de-la-selva',
    BABY,
    'turquoise',
    `${at('lola', 2)} laughing in front of an enormous toucan with a big orange beak. Two huge flat green leaves.`,
  ),
  cover(
    'aventura-espacial',
    GOUACHE,
    'navy',
    `${CAST.tomas} sits in a cardboard rocket with a painted number 5, flying up past one ringed mustard planet and three simple stars.`,
  ),
  cover(
    'valle-de-los-dinosaurios',
    GOUACHE,
    'mint',
    `${at('benja', 5)} sits on the back of a friendly long-necked green dinosaur that turns its head to look at him. A small volcano shape far away, two big ferns.`,
  ),
  cover(
    'reino-encantado',
    GOUACHE,
    'lavender',
    `${at('martina', 5)} wears a small mustard crown and holds a paintbrush; behind her a simple castle that is grey on the left and full of color on the right where she painted it.`,
  ),
  cover(
    'secreto-del-fondo-del-mar',
    GOUACHE,
    'mint',
    `${at('sofi', 5)} swims underwater inside a clear round bubble helmet next to a big friendly sea turtle. Two coral plants and a small treasure chest. Flat blues and terracotta.`,
  ),
  cover(
    'superheroe-por-un-dia',
    GOUACHE,
    'mustard',
    `${at('benja', 5)} in a coral cape and a navy eye mask stands on a rooftop with fists on hips, a small cat on the chimney looking at him admiringly. Two simple houses below.`,
  ),
  cover(
    'la-gran-carrera',
    GOUACHE,
    'coral',
    `${CAST.tomas} drives a small coral go-kart with the number 5, leaning forward and laughing, a checkered flag waving at the side, two simple cones on a curving track.`,
  ),
  cover(
    'hermano-mayor',
    GOUACHE,
    'cream',
    `${at('benja', 5)} sits on a sofa very carefully holding a baby wrapped in a mint blanket, looking at the viewer proudly.`,
  ),
  cover(
    'mi-primer-dia-de-clases',
    GOUACHE,
    'mustard',
    `${at('martina', 5)} with a big terracotta backpack stands at an open school door holding the strap with both hands, a little nervous but smiling; inside, a glimpse of a colorful classroom.`,
  ),
  cover(
    'gol-de-campeon',
    READER,
    'mint',
    `${at('benja', 8)} in a navy jersey with the number 10 kicks a ball diagonally, the ball leaving the frame with speed lines; two teammates celebrating behind. No magic trail.`,
  ),
  cover(
    'las-tardes-con-los-abuelos',
    READER,
    'coral',
    `${at('martina', 8)} cooking with her grandmother (grey bun, cardigan) and grandfather (glasses, sweater), all three laughing with flour on their hands; a cloud of flour drawn like in a comic.`,
  ),
  cover(
    'un-lunes-al-reves',
    READER,
    'mustard',
    `${at('alex', 8)} upside down with a cereal bowl, the cereal floating upward; behind, the family dog walking a person on a leash. Funny, absurd, energetic. No lettering.`,
  ),
  cover(
    'el-misterio-del-faro',
    NOVEL,
    'navy',
    `${at('alex', 11)} seen from behind and below, with a flashlight and a notebook on dark rocks, looking at a tall lighthouse whose light is off; the flashlight beam is a flat shape.`,
  ),
  cover(
    'la-navidad-de-nombre',
    BABY,
    'redSat',
    `${at('lola', 2)} in a red knitted hat looks up at a big flat green fir tree with three round ornaments and one flat yellow star on top. No snow, no glow.`,
  ),
  cover(
    'cuando-naciste',
    BABY,
    'turquoise',
    `A newborn baby with light-brown wisps of hair and fair skin (Lola as a newborn), wrapped snugly in a yellow blanket, eyes wide open, held by two adult hands seen from below (hands only, no faces). Large friendly baby face in the upper half.`,
  ),
  cover(
    'los-mejores-del-mundo',
    BABY,
    'yellowSat',
    `${at('lola', 2)} sits on the shoulders of a tall adult seen from behind (only back, arms and hair, no face), both arms raised high in joy, holding a big flat red heart.`,
  ),
  cover(
    'chau-panal',
    BABY,
    'blueSat',
    `${at('lola', 2)} stands proudly in a yellow t-shirt and colorful trousers next to a small flat red potty with the lid down, one arm raised high, waving goodbye to a folded white diaper on the floor. Big smile.`,
  ),
  cover(
    'el-volcan-del-enojo',
    GOUACHE,
    'mustard',
    `${at('sofi', 5)} stands with fists clenched and puffed red cheeks, taking a deep breath; beside her a small friendly volcano as tall as she is, letting out one puff of red smoke. Flat shapes, no fire glow.`,
  ),
  cover(
    'el-diente-que-se-cayo',
    READER,
    'lavender',
    `${at('sofi', 7)} laughs wide showing a missing front tooth and holds up a tiny tooth between two fingers; a small friendly mouse with a tiny crown peeks from a slipper at the bottom corner. Comic energy.`,
  ),
  cover(
    'el-club-de-detectives',
    READER,
    'mint',
    `${at('tomas', 8)} crouches with a big magnifying glass over a trail of flat paw prints and cookie crumbs, a notebook under his arm; a shaggy dog peeks from behind a tree at the right. Funny and energetic, no lettering.`,
  ),
  cover(
    'dentro-del-videojuego',
    NOVEL,
    'navy',
    `${at('alex', 11)} seen from the side, stepping through a glowing flat doorway made of square pixel blocks into a blocky pixelated landscape; the controller dangles from one hand. No text, no UI, no numbers.`,
  ),
  cover(
    'feliz-cumpleanos',
    GOUACHE,
    'coral',
    `${at('martina', 5)} in a mustard party hat leans over a round cake with a few small candles, cheeks puffed to blow them out, a big flat balloon beside her. Flat confetti shapes.`,
  ),
  // ---- Profesionales: historias nuevas (auditoría de mercado) ---------------------------------
  cover(
    'el-rincon-de-la-calma',
    MINIMAL,
    'lavender',
    `${GENERIC} sits cross-legged on a round cushion in a cozy corner with a small lamp and a potted plant, eyes closed, both hands resting on the belly. Calm and quiet.`,
    true,
  ),
  cover(
    'respiro-como-un-globo',
    MINIMAL,
    'mint',
    `${GENERIC} with cheeks slightly puffed holds a big flat blue balloon in front of the belly, breathing out gently with a soft smile.`,
    true,
  ),
  cover(
    'mi-termometro-verde-amarillo-rojo',
    MINIMAL,
    'cream',
    `${GENERIC} stands beside a tall flat thermometer drawn with three zones in green, yellow and red, pointing at the green zone and smiling. No numbers or letters.`,
    true,
  ),
  cover(
    'cuando-todo-es-demasiado-ruido',
    MINIMAL,
    'mustard',
    `${GENERIC} wearing big headphones with a calm expression, surrounded by a few gentle flat wave-shaped sound lines, in a plain room.`,
    true,
  ),
  cover(
    'cuando-cambia-el-plan',
    MINIMAL,
    'cream',
    `${GENERIC} looks at a simple flat picture-card board where one picture card (a sun) is being swapped for another (a rain cloud) by a hand; calm and curious. No text.`,
    true,
  ),
  cover(
    'voy-al-supermercado',
    MINIMAL,
    'mint',
    `${GENERIC} pushes a small shopping cart with a few simple fruits through a simple store aisle with shelves, calm and proud. No text or prices.`,
    true,
  ),
  cover(
    'los-ruidos-fuertes',
    MINIMAL,
    'lavender',
    `${GENERIC} wearing big yellow ear defenders stands calmly at a distance while a flat fire truck passes in the background. No text.`,
    true,
  ),
  cover(
    'mi-rutina-de-la-manana',
    MINIMAL,
    'cream',
    `${GENERIC} at a bathroom sink brushing teeth, next to a flat picture sequence on the wall (a bed, a toothbrush, a breakfast bowl) without any text.`,
    true,
  ),
  cover(
    'las-letras-de-mi-nombre',
    MINIMAL,
    'mustard',
    `${GENERIC} holds four big flat building blocks, each with a different simple shape on it (no readable letters), lined up like the letters of a name, proud smile.`,
    true,
  ),
  cover(
    'el-sonido-escondido',
    MINIMAL,
    'mint',
    `${GENERIC} with a hand cupped behind the ear, listening carefully, small round flat shapes floating around as if hidden sounds, curious smile.`,
    true,
  ),
  cover(
    'detective-de-palabras',
    MINIMAL,
    'lavender',
    `${GENERIC} holds a magnifying glass over a big open book, a few empty flat speech-bubble shapes floating above, curious expression. No text.`,
    true,
  ),
  cover(
    'hoy-estoy-triste',
    MINIMAL,
    'cream',
    `${GENERIC} sits under a small grey rain cloud hugging a soft plush toy, a gentle kind expression, a calm adult hand resting on their shoulder (no face visible).`,
    true,
  ),
  cover(
    'lo-que-siento-en-el-cuerpo',
    MINIMAL,
    'coral',
    `${GENERIC} stands with one hand on the chest; flat shapes show a small glowing heart and a small knot in the tummy as simple symbols on the body. Friendly and calm.`,
    true,
  ),
  cover(
    'me-equivoque-y-no-pasa-nada',
    MINIMAL,
    'mint',
    `${GENERIC} looks at a wobbly tower of blocks that has fallen on the floor, shrugging with a small smile, one hand picking up a block to try again.`,
    true,
  ),
  cover(
    'esperar-mi-turno',
    MINIMAL,
    'mustard',
    `${GENERIC} waits in line behind another child (seen from behind) at a playground slide, patient posture, hands behind the back, calm smile.`,
    true,
  ),
  cover(
    'voy-al-medico-y-me-vacunan',
    MINIMAL,
    'lavender',
    `${GENERIC} sits on a doctor's exam table smiling, a friendly doctor (kind eyes, no mask) shows a small round sticker; a simple clean room, calm mood.`,
    true,
  ),
  cover(
    'hermano-mayor-pro',
    MINIMAL,
    'lavender',
    `${GENERIC} sits on a simple sofa holding a small wrapped baby carefully in both arms, looking down gently. Calm, tender, minimal graphic style.`,
    true,
  ),
  cover(
    'chau-panal-pro',
    MINIMAL,
    'mint',
    `${GENERIC} stands in a yellow t-shirt and simple trousers beside a small closed potty, one arm raised proudly, a folded diaper on the floor. Clothed, calm, minimal graphic style.`,
    true,
  ),
  // ---- Celebraciones -------------------------------------------------------------------------
  cover(
    'el-cumpleanos-mas-magico',
    GOUACHE,
    'coral',
    `${CAST.tomas} in a mustard party hat blows out candles on a round cake, cheeks puffed, while three friends around the table hold the same small booklet. Flat confetti shapes.`,
  ),
  cover(
    'unicornio-del-arcoiris',
    GOUACHE,
    'lavender',
    `${CAST.sofi} rides a friendly white unicorn with a short simple rainbow mane (flat stripes, no shine) over two round hills.`,
  ),
  // Ocasiones (primera comunión y graduación): respeto religioso, sin figuras sagradas ni efectos.
  cover(
    'mi-primera-comunion',
    GOUACHE,
    'cream',
    `Martina, 8 (straight dark-brown bob with bangs, freckles, olive skin) wears a simple white First Communion dress and holds a small white candle and a simple rosary in her hands, smiling calmly. Behind her, a simple small church exterior with a plain wooden door, and her family (a grandmother, her parents) standing close by. Warm natural daylight. No religious figures of any kind, no Jesus, no Virgin Mary, no saints, no angels, no halos, no rays of light, no glow, no host, no chalice.`,
  ),
  cover(
    'mi-graduacion',
    GOUACHE,
    'mint',
    `Benja, 6 (short black coily hair, warm dark-brown skin, red sneakers) wears a tiny navy graduation gown and cap and holds a rolled diploma tied with a coral ribbon, beaming. Around him in a simple school patio, two classmates in small gowns cheer, and a few flat balloons float. Blank diploma with no writing.`,
  ),
  // ---- Profesionales (Minimalismo gráfico, chico genérico) -------------------------------------
  cover(
    'las-letras-que-bailan',
    MINIMAL,
    'cream',
    `${GENERIC} in a yellow t-shirt laughs while five big flat letters (A, M, S, O, L) jump out of an open book around them.`,
    true,
  ),
  cover(
    'el-jardin-de-las-emociones',
    MINIMAL,
    'mint',
    `${GENERIC} kneels in a simple garden where five flowers each have a different simple face (happy, sad, angry, scared, calm); the child touches the calm one.`,
    true,
  ),
  cover(
    'un-pasito-mas',
    MINIMAL,
    'lavender',
    `${GENERIC} climbs a simple stepped hill, one foot on the next step, while an adult hand reaches from the side to help. A small flag at the top.`,
    true,
  ),
  cover(
    'mi-visita-al-dentista',
    MINIMAL,
    'mint',
    `${GENERIC} sits in a simple dental chair, smiling with a hand mirror, while a friendly dentist (mask down, kind eyes) shows a toothbrush. Very simple clean room.`,
    true,
  ),
  cover(
    'mi-primer-dia-de-clases-pro',
    MINIMAL,
    'cream',
    `${GENERIC} with a backpack stands at a school door, a little nervous but smiling; minimal graphic style.`,
    true,
  ),
  // ---- Muestras de estilo (archivo 04) --------------------------------------------------------
  style(
    'gouache-editorial',
    'Gouache editorial picture-book illustration, opaque matte paint, visible brush texture, bold simple shapes, palette of navy, coral, mustard and mint.',
  ),
  style(
    'collage-papel',
    'Cut-paper collage illustration: shapes cut from hand-painted textured papers, visible paper edges and layering, slight shadows between layers, high contrast, bold flat colors.',
  ),
  style(
    'minimalismo-grafico',
    'Minimal flat graphic illustration, clean even line, geometric shapes, 3 colors on cream, lots of white space, no texture.',
  ),
  style(
    'cuento-clasico',
    'Classic storybook illustration, fine dip-pen ink line with gentle cross-hatching and a light wash of muted color, vintage book feel.',
  ),
  style(
    'lapices-de-colores',
    'Colored pencil illustration on textured paper, visible pencil strokes and paper tooth, warm hand-made feel, slightly uneven coloring.',
  ),
  style(
    'acuarela',
    'Traditional watercolor illustration with controlled washes and clear shapes, white paper showing through. Keep it crisp: no haze, no glow, no sparkles.',
  ),
  style(
    'cartoon-3d',
    'Soft 3D cartoon render with rounded clay-like shapes and simple lighting. Original character design only, nothing that resembles a known studio character.',
  ),
  style(
    'para-colorear',
    'Black-and-white coloring-book line art, clean closed outlines of even weight, no shading, no gray, white background.',
  ),
];

const MODEL = 'gemini-3.1-flash-image';
const price = VERTEX_PRICES[MODEL] ?? { input: 2, output: 120 };
const unit = (size: '1K' | '2K') =>
  ((size === '2K' ? 1680 : 1120) * price.output + 2600 * price.input) / 1_000_000;
const only = values.only?.split(',');
const todo = JOBS.filter((job) => !only || only.some((key) => job.file.includes(key))).filter(
  (job) => !existsSync(path.join(OUT, job.file)),
);
const estimate = todo.reduce((sum, job) => sum + unit(job.size), 0);
const budget = Number(values.budget);
console.log(
  `${String(todo.length)} imágenes por generar (de ${String(JOBS.length)}) · costo estimado USD ${estimate.toFixed(2)} · tope USD ${budget.toFixed(2)}`,
);
if (!values.yes) {
  console.log('Sin --yes no se genera nada.');
  process.exit(0);
}

const token = execFileSync('gcloud', ['auth', 'print-access-token'], {
  env: { ...process.env, CLOUDSDK_ACTIVE_CONFIG_NAME: 'storynido' },
})
  .toString()
  .trim();
const client = new VertexClient({
  projectId: 'storynido-staging',
  models: () => ({ text: 'gemini-3.5-flash', image: MODEL }),
  getAccessToken: () => Promise.resolve(token),
});

let spent = 0;
for (const job of todo) {
  if (spent >= budget) {
    console.log(`Tope alcanzado (USD ${spent.toFixed(2)}): se frena.`);
    break;
  }
  const parts: Record<string, unknown>[] = (job.references ?? [])
    .filter((ref) => existsSync(path.join(OUT, ref)))
    .map((ref) => ({
      inlineData: {
        mimeType: 'image/webp',
        data: readFileSync(path.join(OUT, ref)).toString('base64'),
      },
    }));
  parts.push({ text: job.prompt });
  try {
    const { response, usage } = await client.generate(MODEL, parts as never, {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: job.aspect, imageSize: job.size },
    });
    const inline = response.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData,
    )?.inlineData;
    if (!inline) throw new Error('sin imagen');
    const target = path.join(OUT, job.file);
    mkdirSync(path.dirname(target), { recursive: true });
    const webp = await sharp(Buffer.from(inline.data, 'base64'))
      .resize({ width: job.width, height: job.height, fit: 'cover' })
      .webp({ quality: 86 })
      .toBuffer();
    writeFileSync(target, webp);
    spent += usage.costUsdMicros / 1_000_000;
    console.log(
      `ok ${job.file} (USD ${(usage.costUsdMicros / 1_000_000).toFixed(3)}; total ${spent.toFixed(2)})`,
    );
  } catch (error) {
    console.log(`ERROR ${job.file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
console.log(`Listo. Gastado: USD ${spent.toFixed(2)}`);
