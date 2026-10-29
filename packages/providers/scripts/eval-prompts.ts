/**
 * Prueba antes/después de los prompts (AUDITORIA-PRODUCTO §5, paso 3): una historia por público,
 * el mismo protagonista inventado (sin foto), con el prompt anterior (sin reglas narrativas ni
 * dirección de arte) y con el actual. Arma un reporte HTML lado a lado.
 *
 *   pnpm eval:prompts            # solo estima el costo
 *   pnpm eval:prompts --yes      # genera (cuesta dinero)
 *
 * Opciones: --only slug,slug · --age 10 · --only-after (solo la variante nueva) · --pages 2 (páginas ilustradas además de lámina y portada) · --budget 4 (USD, tope)
 *           --style acuarela · --model gemini-3.1-flash-image
 * Credenciales: token de gcloud con la configuración "storynido" (nunca la de Timbermap).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  CHARACTER_REFERENCE_SCENE,
  DEFAULT_EDITORIAL_CONFIG,
  PREVIEW_ILLUSTRATED_PAGES,
  artDirection,
  buildIllustrationPrompt,
  buildStoryPrompt,
  coverScene,
  describeCharacterSheet,
  editorialPlan,
  narrativeRules,
  type BookEvent,
  type Channel,
  type CharacterSheet,
  type ImageData,
  type StoryPromptInput,
} from '@storynido/shared';
import sharp from 'sharp';

import { SEED_NEW_STORIES, SEED_STORIES, SEED_STYLES } from '../../../firebase/seed-data/catalog';
import {
  VERTEX_PRICES,
  VertexClient,
  VertexImageProvider,
  VertexTextProvider,
} from '../src/gcp/vertex';

const { values } = parseArgs({
  options: {
    only: { type: 'string' },
    'only-after': { type: 'boolean', default: false },
    pages: { type: 'string', default: '2' },
    /** Edad del protagonista inventado (por ejemplo 10 para las historias de 9 a 12). */
    age: { type: 'string', default: '6' },
    budget: { type: 'string', default: '4' },
    style: { type: 'string', default: 'acuarela' },
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

/** Protagonista inventado: nunca la foto de un chico real. */
const CHILD = { name: 'Mateo', age: Number(values.age), pronouns: 'he' as const };
const SHEET: CharacterSheet = {
  apparentAge: `about ${values.age} years old`,
  hair: 'short, curly, dark brown hair',
  eyes: 'brown eyes',
  skinTone: 'medium olive skin',
  distinctiveFeatures: ['round glasses', 'a few freckles'],
  clothing: 'a yellow t-shirt and blue sneakers',
};

const ALL_CASES: { channel: Channel; slug: string; event?: BookEvent; goal?: string }[] = [
  { channel: 'families', slug: 'aventura-espacial' },
  {
    channel: 'events',
    slug: 'el-cumpleanos-mas-magico',
    event: { type: 'birthday', date: null, turningAge: 6, theme: 'dinosaurios' },
  },
  {
    channel: 'professionals',
    slug: 'mi-visita-al-dentista',
    goal: 'prepararse para la primera visita al dentista',
  },
];
const ONLY = values.only?.split(',');
// Una historia que no está en los casos fijos se prueba como Familias.
const CASES = ONLY
  ? ONLY.map(
      (slug) =>
        ALL_CASES.find((item) => item.slug === slug) ?? { channel: 'families' as const, slug },
    )
  : ALL_CASES;
const ALL_VARIANTS = ['antes', 'después'] as const;
const VARIANTS = values['only-after'] ? (['después'] as const) : ALL_VARIANTS;

const stories = [...SEED_STORIES, ...SEED_NEW_STORIES];
const style = SEED_STYLES.find((item) => item.slug === values.style);
if (!style) throw new Error(`Estilo desconocido: ${values.style}`);

const pagesToIllustrate = Number(values.pages);
const imagesPerVariant = 2 + pagesToIllustrate;
const images = CASES.length * VARIANTS.length * imagesPerVariant;
const price = VERTEX_PRICES[values.model] ?? { input: 2, output: 120 };
const estimate = (images * (1120 * price.output + 2600 * price.input)) / 1_000_000 + 0.1;
const budgetUsd = Number(values.budget);

console.log(
  `Plan: ${String(CASES.length)} historias × ${String(VARIANTS.length)} variantes × ${String(imagesPerVariant)} imágenes = ${String(images)} imágenes (${values.model}, ${style.slug}) + ${String(CASES.length * VARIANTS.length * 2)} llamadas de texto`,
);
console.log(`Costo estimado: USD ${estimate.toFixed(2)} · tope: USD ${budgetUsd.toFixed(2)}`);
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
  `prompts-${new Date().toISOString().replace(/[:.]/g, '-')}`,
);
mkdirSync(outDir, { recursive: true });

const character = `${CHILD.name}, ${describeCharacterSheet(SHEET)}`;
let spentMicros = 0;
const overBudget = () => spentMicros / 1_000_000 >= budgetUsd;

interface Result {
  title: string;
  pages: string[];
  images: { file: string | null; label: string; error?: string }[];
}
const report: Record<string, Partial<Record<(typeof ALL_VARIANTS)[number], Result>>> = {};

for (const testCase of CASES) {
  const story = stories.find((item) => item.slug === testCase.slug);
  if (!story) throw new Error(`Historia desconocida: ${testCase.slug}`);
  const plan = editorialPlan(
    { length: null, textDensity: 'balanced', readingLevel: 'developing', contentType: 'story' },
    DEFAULT_EDITORIAL_CONFIG,
    story.pageCount,
  );
  const request = {
    language: 'es' as const,
    childName: CHILD.name,
    age: CHILD.age,
    pronouns: CHILD.pronouns,
    likes: ['dinosaurios', 'dibujar'],
    petName: null,
    bestFriendName: null,
    dedication: null,
    storyTitle: story.title.es,
    lessons: [],
    pageCount: Math.max(plan.narrativePages, PREVIEW_ILLUSTRATED_PAGES),
    wordsPerPage: plan.words,
    mustInclude: [],
  };
  const input: StoryPromptInput = {
    ...request,
    template: story.textPromptTemplate,
    event: testCase.event ?? null,
    goal: testCase.goal ?? null,
    levelGuidance: plan.levelGuidance,
  };
  const byVariant: Partial<Record<(typeof ALL_VARIANTS)[number], Result>> = {};
  report[testCase.slug] = byVariant;

  for (const variant of VARIANTS) {
    const after = variant === 'después';
    // "Antes": el mismo prompt sin las reglas narrativas ni la dirección de arte.
    const storyPrompt = (extra: Partial<StoryPromptInput>) => {
      const full = buildStoryPrompt({ ...input, ...extra });
      return after ? full : full.replace(`${narrativeRules(input)}\n`, '');
    };
    const direction = after
      ? artDirection({ age: CHILD.age, channel: testCase.channel, palette: story.palette })
      : null;

    const { usage: planUsage, ...storyPlan } = await text.planStory({
      ...request,
      prompt: storyPrompt({}),
    });
    spentMicros += planUsage.costUsdMicros;
    const written = await text.generateStory({
      ...request,
      prompt: storyPrompt({ plan: storyPlan }),
    });
    spentMicros += written.usage.costUsdMicros;
    console.log(`✓ ${testCase.slug} · ${variant} · texto: ${written.title}`);

    const result: Result = {
      title: written.title,
      pages: written.pages.map((page) => page.text),
      images: [],
    };
    const scenes = [
      { label: 'Lámina del personaje', scene: CHARACTER_REFERENCE_SCENE },
      { label: 'Portada', scene: coverScene(written.pages[0]?.illustrationPrompt) },
      ...written.pages.slice(0, pagesToIllustrate).map((page, index) => ({
        label: `Página ${String(index + 1)}`,
        scene: page.illustrationPrompt,
      })),
    ];
    let sheet: ImageData | null = null;
    for (const [index, { label, scene }] of scenes.entries()) {
      if (overBudget()) {
        result.images.push({ file: null, label, error: 'tope de presupuesto alcanzado' });
        continue;
      }
      try {
        const generated = await image.generateIllustration({
          prompt: buildIllustrationPrompt({
            template: story.imagePromptTemplate,
            scene,
            character,
            style: style.promptModifier,
            direction,
          }),
          stylePrompt: style.promptModifier,
          character: { description: character, photo: null },
          references: sheet ? [sheet] : [],
          aspectRatio: '3:4',
          // La misma semilla en las dos variantes: la diferencia es el prompt.
          seed: 11 + index,
        });
        spentMicros += generated.usage.costUsdMicros;
        sheet ??= { bytes: generated.bytes, mimeType: generated.mimeType };
        const file = `${testCase.slug}__${after ? 'despues' : 'antes'}__${String(index)}.webp`;
        await sharp(generated.bytes).webp({ quality: 82 }).toFile(path.join(outDir, file));
        result.images.push({ file, label });
        console.log(`✓ ${testCase.slug} · ${variant} · ${label}`);
      } catch (error) {
        result.images.push({ file: null, label, error: (error as Error).message.slice(0, 200) });
        console.log(`✗ ${testCase.slug} · ${variant} · ${label}: ${(error as Error).message}`);
      }
    }
    byVariant[variant] = result;
  }
}

const escape = (value: string) => value.replace(/[<>&"]/g, (c) => `&#${String(c.charCodeAt(0))};`);
const column = (variant: string, result?: Result) =>
  result
    ? `<div class="col"><h3>${variant}: ${escape(result.title)}</h3><div class="imgs">${result.images
        .map((item) =>
          item.file
            ? `<figure><img src="${item.file}" alt="${escape(item.label)}"><figcaption>${escape(item.label)}</figcaption></figure>`
            : `<figure class="error"><p>${escape(item.label)}: ${escape(item.error ?? '')}</p></figure>`,
        )
        .join(
          '',
        )}</div><ol>${result.pages.map((page) => `<li>${escape(page)}</li>`).join('')}</ol></div>`
    : '';
const sections = CASES.map(
  ({ channel, slug }) =>
    `<section><h2>${channel} · ${slug}</h2><div class="row">${column('Antes', report[slug]?.antes)}${column('Después', report[slug]?.['después'])}</div></section>`,
).join('');
writeFileSync(
  path.join(outDir, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Prompts antes y después</title><style>
body{font-family:system-ui;margin:24px;background:#fff8f1;color:#26324a}
.row{display:grid;grid-template-columns:1fr 1fr;gap:24px}.imgs{display:flex;gap:8px;flex-wrap:wrap}
figure{margin:0;width:180px}img{width:180px;border-radius:8px}figcaption{font-size:12px}
.error p{color:#a33f33;font-size:12px}ol{font-size:14px;line-height:1.5}section{margin-bottom:48px}
</style><h1>Prompts antes y después · ${escape(style.slug)} · ${escape(values.model)}</h1>
<p>Protagonista inventado: ${escape(character)} · Costo: USD ${(spentMicros / 1_000_000).toFixed(2)}</p>${sections}`,
);
console.log(`Costo real: USD ${(spentMicros / 1_000_000).toFixed(2)}`);
console.log(`Reporte: ${path.join(outDir, 'index.html')}`);
