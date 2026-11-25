/**
 * Casos fijos de la vista previa (DECISIONS 264): arma la muestra como la API (lámina en el estilo
 * elegido con el dibujo del perfil solo como rasgos, portada en un lugar del cuento y las primeras
 * páginas con su zona de texto) y guarda imágenes, prompts y controles de texto.
 *
 *   pnpm eval:preview --case lu --photo foto.jpg --drawing dibujo.webp   # solo estima
 *   pnpm eval:preview --case lu --photo foto.jpg --drawing dibujo.webp --yes
 *
 * Casos:
 *   lu              foto de adulta, cuento de 5 años, «Buenas noches» (0 a 2), estilo clásico, dibujo
 *                   del perfil en gouache, borrador desde /en con el perfil en español de Argentina y
 *                   el papá sin describir. Usa la foto y el dibujo que se pasen (de su dueño).
 *   lu-otro-estilo  lo mismo con lápices de colores.
 *   adulto-5        sin foto: una ficha de adulto con anteojos de sol para un cuento de 5 años.
 *   familia         sin foto: protagonista de 6 con mamá y hermano que nadie describió.
 * Nunca fotos de chicos reales: sin --photo, los casos usan una ficha inventada.
 * Credenciales: token de gcloud con la configuración "storynido" (nunca la de Timbermap).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  CHARACTER_REFERENCE_SCENE,
  DEFAULT_EDITORIAL_CONFIG,
  PREVIEW_ILLUSTRATED_PAGES,
  artDirection,
  bookLanguageFor,
  bookLayout,
  buildIllustrationPrompt,
  buildStoryPrompt,
  castNote,
  companionNote,
  companionReferenceScene,
  coverScene,
  coverSetting,
  describeCharacter,
  describeTraits,
  editorialPlan,
  layoutSceneNote,
  pageLayout,
  scenesFor,
  spanishVoiceFor,
  visualBibleCheck,
  withChildName,
  type CharacterSheet,
  type CharacterTraits,
  type ImageData,
  type Locale,
  type MustKeepTrait,
} from '@storynido/shared';
import sharp from 'sharp';

import {
  SEED_DRAFT_STORIES,
  SEED_NEW_STORIES,
  SEED_PRO_STORIES,
  SEED_STORIES,
  SEED_STYLES,
} from '../../../firebase/seed-data/catalog';
import {
  VERTEX_PRICES,
  VertexClient,
  VertexImageProvider,
  VertexTextProvider,
} from '../src/gcp/vertex';

const { values } = parseArgs({
  options: {
    case: { type: 'string', default: 'adulto-5' },
    photo: { type: 'string' },
    drawing: { type: 'string' },
    pages: { type: 'string', default: String(PREVIEW_ILLUSTRATED_PAGES) },
    budget: { type: 'string', default: '1.5' },
    model: { type: 'string', default: 'gemini-3.1-flash-image' },
    project: { type: 'string', default: 'storynido-staging' },
    out: { type: 'string', default: 'eval-reports' },
    yes: { type: 'boolean', default: false },
  },
});

if (values.project.startsWith('timbermap')) {
  console.error('Este script nunca corre contra proyectos de Timbermap.');
  process.exit(1);
}

interface Case {
  name: string;
  age: number;
  pronouns: 'she' | 'he';
  likes: string[];
  story: string;
  style: string;
  /** Idioma del perfil y de la URL desde la que se creó el borrador. */
  profileLocale: Locale | null;
  urlLocale: Locale;
  country: string;
  /** Sin foto: la ficha y los rasgos inventados. */
  sheet: CharacterSheet;
  traits: CharacterTraits;
  mustKeep: MustKeepTrait[];
  /** Palabras que tienen que aparecer en el texto (por ejemplo, el familiar sin describir). */
  expectInText?: RegExp;
}

const LU: Case = {
  name: 'Lu',
  age: 5,
  pronouns: 'she',
  likes: ['gimnasia'],
  story: 'buenas-noches',
  style: 'cuento-clasico',
  profileLocale: 'es',
  urlLocale: 'en',
  country: 'AR',
  sheet: {
    apparentAge: 'around 35-40 years old',
    hair: 'blonde, medium-length, straight with bangs',
    eyes: 'brown eyes',
    skinTone: 'light',
    distinctiveFeatures: ['wearing dark sunglasses', 'wide smile showing teeth'],
    clothing: 'cream-colored fleece zip-up jacket and blue skinny jeans',
  },
  traits: {
    skinTone: 'light',
    hairColor: 'blond',
    hairLength: 'medium',
    hairType: 'straight',
    eyeColor: 'brown',
    glasses: true,
    distinctive: null,
  },
  mustKeep: ['hair', 'skinTone', 'glasses'],
};

const CASES: Record<string, Case> = {
  lu: LU,
  'lu-otro-estilo': { ...LU, style: 'lapices-de-colores' },
  'adulto-5': { ...LU, name: 'Caro', likes: ['bailar'], profileLocale: null, urlLocale: 'es' },
  familia: {
    name: 'Nico',
    age: 6,
    pronouns: 'he',
    likes: ['cocinar con su mamá y su hermano'],
    story: 'aventura-espacial',
    style: 'gouache-editorial',
    profileLocale: 'es',
    urlLocale: 'es',
    country: 'MX',
    sheet: {
      apparentAge: 'about 6 years old',
      hair: 'short wavy black hair',
      eyes: 'dark brown eyes',
      skinTone: 'warm brown skin',
      distinctiveFeatures: [],
      clothing: 'a red t-shirt and green shorts',
    },
    traits: {
      skinTone: 'brown',
      hairColor: 'black',
      hairLength: 'short',
      hairType: 'wavy',
      eyeColor: 'brown',
      glasses: false,
      distinctive: null,
    },
    mustKeep: ['hair', 'skinTone'],
    expectInText: /mam[aá]|herman/i,
  },
  // 9 a 12 (DECISIONS 319): una chica en el Diario con Cuaderno y un chico en la Academia con Manga.
  diario: {
    name: 'Vale',
    age: 11,
    pronouns: 'she',
    likes: ['la guitarra', 'dibujar'],
    story: 'el-diario-de-nombre',
    style: 'cuaderno',
    profileLocale: 'es',
    urlLocale: 'es',
    country: 'MX',
    sheet: {
      apparentAge: 'about 11 years old',
      hair: 'long straight dark-brown hair in a low ponytail',
      eyes: 'dark brown eyes',
      skinTone: 'medium tan skin',
      distinctiveFeatures: [],
      clothing: 'a mustard hoodie and dark jeans',
    },
    traits: {
      skinTone: 'tan',
      hairColor: 'dark-brown',
      hairLength: 'long',
      hairType: 'straight',
      eyeColor: 'brown',
      glasses: false,
      distinctive: null,
    },
    mustKeep: ['hair', 'skinTone'],
  },
  dragones: {
    name: 'Joaco',
    age: 12,
    pronouns: 'he',
    likes: ['los dragones', 'el fútbol'],
    story: 'la-academia-de-dragones',
    style: 'manga',
    profileLocale: 'es',
    urlLocale: 'es',
    country: 'AR',
    sheet: {
      apparentAge: 'about 12 years old',
      hair: 'short curly light-brown hair',
      eyes: 'green eyes',
      skinTone: 'light skin with freckles',
      distinctiveFeatures: ['round glasses'],
      clothing: 'a navy t-shirt and grey cargo trousers',
    },
    traits: {
      skinTone: 'light',
      hairColor: 'light-brown',
      hairLength: 'short',
      hairType: 'curly',
      eyeColor: 'green',
      glasses: true,
      distinctive: null,
    },
    mustKeep: ['hair', 'glasses'],
  },
};

const testCase = CASES[values.case];
if (!testCase)
  throw new Error(`Caso desconocido: ${values.case} (${Object.keys(CASES).join(', ')})`);
const story = [
  ...SEED_STORIES,
  ...SEED_NEW_STORIES,
  ...SEED_DRAFT_STORIES,
  ...SEED_PRO_STORIES,
].find((item) => item.slug === testCase.story);
const style = SEED_STYLES.find((item) => item.slug === testCase.style);
if (!story || !style) throw new Error('Historia o estilo desconocidos en el catálogo semilla.');

const pagesToIllustrate = Number(values.pages);
const price = VERTEX_PRICES[values.model] ?? { input: 2, output: 120 };
// Lámina y acompañante a 1K; portada y páginas a 2K (como la API).
const images = 2 + 1 + pagesToIllustrate;
const estimate = (images * (1680 * price.output + 3000 * price.input)) / 1_000_000 + 0.08;
const budgetUsd = Number(values.budget);
console.log(
  `Caso ${values.case}: ${String(images)} imágenes (${values.model}, ${style.slug}) + texto · estimado USD ${estimate.toFixed(2)} · tope USD ${budgetUsd.toFixed(2)}`,
);
if (!values.yes) {
  console.log('Sin --yes no se genera nada.');
  process.exit(0);
}
if (estimate > budgetUsd) {
  console.error('La estimación supera el tope: bajá --pages o subí --budget.');
  process.exit(1);
}

const token = execFileSync('gcloud', ['auth', 'print-access-token'], {
  env: { ...process.env, CLOUDSDK_ACTIVE_CONFIG_NAME: 'storynido' },
})
  .toString()
  .trim();
const client = new VertexClient({
  projectId: values.project,
  models: () => ({ text: 'gemini-3.5-flash', image: values.model }),
  getAccessToken: () => Promise.resolve(token),
});
const text = new VertexTextProvider(client);
const image = new VertexImageProvider(client);

const outDir = path.resolve(
  values.out,
  `preview-${values.case}-${new Date().toISOString().replace(/[:.]/g, '-')}`,
);
mkdirSync(outDir, { recursive: true });
let spentMicros = 0;
const spend = (usage: { costUsdMicros: number }) => {
  spentMicros += usage.costUsdMicros;
  if (spentMicros / 1_000_000 > budgetUsd) throw new Error('Tope de presupuesto alcanzado.');
};
const readImage = (file: string | undefined): ImageData | null =>
  file
    ? {
        bytes: new Uint8Array(readFileSync(file)),
        mimeType: file.endsWith('.webp') ? 'image/webp' : 'image/jpeg',
      }
    : null;

// 1) Foto: la ficha la describe la IA (como al subirla); sin foto, la ficha inventada.
const photo = readImage(values.photo);
const drawing = readImage(values.drawing);
let sheet = testCase.sheet;
if (photo) {
  const described = await text.describeCharacter(photo);
  spend(described.usage);
  sheet = described.sheet;
}

// 2) Texto: idioma del perfil sobre el de la URL, voseo por país y la historia adaptada a su edad.
const language = bookLanguageFor(testCase.profileLocale, testCase.urlLocale);
const plan = editorialPlan(
  { length: 'mini', textDensity: 'visual', readingLevel: 'beginner', contentType: 'story' },
  DEFAULT_EDITORIAL_CONFIG,
  story.pageCount,
  testCase.age,
);
const layout = bookLayout(testCase.age, 'story');
const request = {
  language,
  childName: testCase.name,
  age: testCase.age,
  pronouns: testCase.pronouns,
  likes: testCase.likes,
  petName: null,
  bestFriendName: null,
  dedication: null,
  storyTitle: withChildName(story.title[language], testCase.name),
  lessons: [],
  pageCount: Math.max(scenesFor(plan.narrativePages, layout), PREVIEW_ILLUSTRATED_PAGES),
  wordsPerPage: plan.words,
  mustInclude: [],
  spanishVoice: spanishVoiceFor(testCase.country),
  protagonistLook: describeTraits(testCase.traits, []),
};
const promptInput = {
  ...request,
  template: story.textPromptTemplate,
  levelGuidance: plan.levelGuidance,
  storyAges: { min: story.ageMin, max: story.ageMax },
};
const { usage: planUsage, ...storyPlan } = await text.planStory({
  ...request,
  prompt: buildStoryPrompt(promptInput),
});
spend(planUsage);
const written = await text.generateStory({
  ...request,
  prompt: buildStoryPrompt({ ...promptInput, plan: storyPlan }),
});
spend(written.usage);
console.log(`✓ texto (${language}): ${written.title}`);

// 3) Imágenes, como la API.
const direction = artDirection({
  age: testCase.age,
  channel: 'families',
  palette: story.palette,
  style: style.slug,
});
const description = describeCharacter(
  testCase.name,
  testCase.age,
  sheet,
  testCase.traits,
  testCase.mustKeep,
);
const prompts: Record<string, string> = {};
const save = async (label: string, generated: ImageData) => {
  const file = `${label}.webp`;
  await sharp(generated.bytes).webp({ quality: 86 }).toFile(path.join(outDir, file));
  console.log(`✓ ${label}`);
  return file;
};
const draw = async (
  label: string,
  scene: string,
  options: {
    character?: string;
    references?: ImageData[];
    traitReferences?: ImageData[];
    resolution?: '1K' | '2K';
    seed: number;
    withPhoto?: boolean;
  },
) => {
  const character = options.character ?? description;
  const prompt = buildIllustrationPrompt({
    template: story.imagePromptTemplate,
    scene,
    character,
    style: style.promptModifier,
    direction,
  });
  prompts[label] = prompt;
  const generated = await image.generateIllustration({
    prompt,
    stylePrompt: style.promptModifier,
    character: { description: character, photo: options.withPhoto === false ? null : photo },
    references: options.references ?? [],
    traitReferences: options.traitReferences ?? [],
    aspectRatio: '3:4',
    resolution: options.resolution,
    seed: options.seed,
  });
  spend(generated.usage);
  await save(label, generated);
  return { bytes: generated.bytes, mimeType: generated.mimeType };
};

// Lámina en el estilo elegido: el dibujo del perfil (gouache) solo como rasgos.
const lamina = await draw('lamina', CHARACTER_REFERENCE_SCENE, {
  traitReferences: drawing ? [drawing] : [],
  seed: 0,
});
const companionPlan = storyPlan.companion ?? null;
const companion = companionPlan
  ? await draw('acompanante', companionReferenceScene(companionPlan), {
      character: companionPlan.look,
      references: [lamina],
      seed: 0,
      withPhoto: false,
    })
  : null;
const sceneCharacter = companionPlan
  ? `${description}\n${companionNote(companionPlan)}`
  : description;
const references = companion ? [lamina, companion] : [lamina];
await draw(
  'portada',
  coverScene(written.pages[0]?.illustrationPrompt, written.title, coverSetting(storyPlan)),
  {
    character: sceneCharacter,
    references,
    resolution: '2K',
    seed: 1,
  },
);
for (const page of written.pages.slice(0, pagesToIllustrate)) {
  const scene = storyPlan.scenes.find((item) => item.pageIndex === page.index);
  const note = visualBibleCheck(storyPlan, scene);
  await draw(
    `pagina-${String(page.index + 1)}`,
    `${page.illustrationPrompt}${note ? ` ${note}` : ''}${castNote(storyPlan.cast)}${layoutSceneNote(
      pageLayout({
        layout,
        words: page.text.split(/\s+/).filter(Boolean).length,
        pageIndex: page.index,
        contentType: 'story',
      }),
    )}`,
    { character: sceneCharacter, references, resolution: '2K', seed: page.index + 2 },
  );
}

// 4) Controles de texto: idioma, nombre en el título y familia sin describir.
const allText = [written.title, ...written.pages.map((page) => page.text)].join('\n');
const spanish = (allText.match(/\b(el|la|los|las|que|y|de|con|una?)\b/gi) ?? []).length;
const english = (allText.match(/\b(the|and|she|her|with|is|to)\b/gi) ?? []).length;
const checks = {
  idiomaPedido: language,
  idiomaDetectado: spanish > english ? 'es' : 'en',
  voseo: /\b(querés|mirá|tenés|vení|podés|sabés|vos)\b/i.test(allText),
  nombreEnTitulo: written.title.includes(testCase.name),
  familiaEnTexto: testCase.expectInText ? testCase.expectInText.test(allText) : null,
  acompanante: companionPlan,
  elenco: storyPlan.cast ?? [],
  lugarDePortada: coverSetting(storyPlan),
};
writeFileSync(
  path.join(outDir, 'resultado.json'),
  JSON.stringify(
    {
      caso: values.case,
      estilo: style.slug,
      costoUsd: spentMicros / 1_000_000,
      ficha: sheet,
      descripcion: description,
      titulo: written.title,
      paginas: written.pages.map((page) => page.text),
      controles: checks,
      plan: storyPlan,
      prompts,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(checks, null, 2));
console.log(`Costo real: USD ${(spentMicros / 1_000_000).toFixed(3)}`);
console.log(`Resultado: ${outDir}`);
