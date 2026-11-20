/**
 * Golden set de prompts de texto (mesa de prompts, 20 nov 2026): 18 casos fijos con protagonistas
 * inventados (nunca fotos), tres variantes del prompt y una rúbrica de siete criterios que
 * puntúa un modelo juez. Solo texto (plan, cuento y escenas): cuesta centavos por corrida.
 *
 *   pnpm eval:golden                # solo estima el costo
 *   pnpm eval:golden --yes          # corre (gasta IA)
 *
 * Variantes: base (el prompt de hoy) · t08 (temperatura 0,8 en el cuento) · modelo (suma páginas
 * modelo escritas por nosotros, por franja de edad). Opciones: --only caso,caso · --variants base,t08
 * · --budget 4 (USD) · --judge gemini-3.5-flash.
 * Credenciales: token de gcloud con la configuración "storynido" (nunca la de Timbermap).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  DEFAULT_EDITORIAL_CONFIG,
  EMPTY_BIRTHDAY,
  buildStoryPrompt,
  countWords,
  editorialPlan,
  pagesOverCap,
  spanishVoiceFor,
  type BookEvent,
  type StoryPromptInput,
} from '@storynido/shared';

import {
  SEED_DRAFT_STORIES,
  SEED_NEW_STORIES,
  SEED_PRO_STORIES,
  SEED_STORIES,
} from '../../../firebase/seed-data/catalog';
import { VertexClient, VertexTextProvider } from '../src/gcp/vertex';

const { values } = parseArgs({
  options: {
    only: { type: 'string' },
    variants: { type: 'string', default: 'base,t08,modelo' },
    budget: { type: 'string', default: '4' },
    judge: { type: 'string', default: 'gemini-3.5-flash' },
    /** resultados.json de una corrida cortada: se saltean las corridas ya hechas y se suman a esa carpeta. */
    resume: { type: 'string' },
    project: { type: 'string', default: 'storynido-staging' },
    out: { type: 'string', default: 'eval-reports' },
    yes: { type: 'boolean', default: false },
  },
});

if (values.project.startsWith('timbermap')) {
  console.error('Este script nunca corre contra proyectos de Timbermap.');
  process.exit(1);
}

type Channel = 'families' | 'events' | 'professionals';
interface GoldenCase {
  id: string;
  /** Pronombre del protagonista inventado. */
  he?: boolean;
  channel: Channel;
  slug: string;
  name: string;
  age: number;
  likes: string[];
  event?: Partial<BookEvent>;
  goal?: string;
}

/** 18 casos: 10 Familias, 5 Celebraciones y 3 Profesionales, con niños inventados. */
const CASES: GoldenCase[] = [
  {
    id: 'fam-espacial-3',
    channel: 'families',
    slug: 'aventura-espacial',
    name: 'Olivia',
    age: 3,
    likes: ['perros', 'bailar'],
  },
  {
    id: 'fam-espacial-6',
    channel: 'families',
    slug: 'aventura-espacial',
    he: true,
    name: 'Mateo',
    age: 6,
    likes: ['dinosaurios', 'dibujar'],
  },
  {
    id: 'fam-faro-10',
    channel: 'families',
    slug: 'el-misterio-del-faro',
    name: 'Julieta',
    age: 10,
    likes: ['kitesurf', 'leer misterios'],
  },
  {
    id: 'fam-dormir-2',
    channel: 'families',
    slug: 'buenas-noches',
    he: true,
    name: 'Bruno',
    age: 2,
    likes: ['el osito', 'los camiones'],
  },
  {
    id: 'fam-dormir-5',
    channel: 'families',
    slug: 'buenas-noches',
    name: 'Emma',
    age: 5,
    likes: ['gimnasia', 'las estrellas'],
  },
  {
    id: 'fam-diente-6',
    channel: 'families',
    slug: 'el-diente-que-se-cayo',
    he: true,
    name: 'Lautaro',
    age: 6,
    likes: ['fútbol', 'los robots'],
  },
  {
    id: 'fam-gol-8',
    channel: 'families',
    slug: 'gol-de-campeon',
    name: 'Sofía',
    age: 8,
    likes: ['fútbol', 'su abuela'],
  },
  {
    id: 'fam-navidad-4',
    channel: 'families',
    slug: 'la-navidad-de-nombre',
    he: true,
    name: 'Thiago',
    age: 4,
    likes: ['los trenes', 'la nieve'],
  },
  {
    id: 'fam-hermano-4',
    channel: 'families',
    slug: 'hermano-mayor',
    name: 'Renata',
    age: 4,
    likes: ['pintar', 'su hermanito'],
  },
  {
    id: 'fam-detectives-10',
    channel: 'families',
    slug: 'el-club-de-detectives',
    he: true,
    name: 'Facundo',
    age: 10,
    likes: ['ajedrez', 'los acertijos'],
  },
  {
    id: 'eve-anito-1',
    channel: 'events',
    slug: 'mi-primer-anito',
    name: 'Alma',
    age: 1,
    likes: ['los globos'],
    event: { type: 'birthday', turningAge: 1 },
  },
  {
    id: 'eve-cumple-6',
    channel: 'events',
    slug: 'el-cumpleanos-mas-magico',
    he: true,
    name: 'Benjamín',
    age: 6,
    likes: ['dinosaurios'],
    event: { type: 'birthday', turningAge: 6, theme: 'dinosaurios' },
  },
  {
    id: 'eve-bautizo',
    channel: 'events',
    slug: 'mi-bautizo',
    name: 'Pía',
    age: 1,
    likes: ['la música'],
    event: { type: 'baptism', turningAge: null },
  },
  {
    id: 'eve-comunion-8',
    channel: 'events',
    slug: 'mi-primera-comunion',
    he: true,
    name: 'Joaquín',
    age: 8,
    likes: ['su abuelo', 'andar en bici'],
    event: { type: 'communion', turningAge: null },
  },
  {
    id: 'eve-graduacion-5',
    channel: 'events',
    slug: 'mi-graduacion',
    name: 'Camila',
    age: 5,
    likes: ['la maestra', 'los bloques'],
    event: { type: 'graduation', turningAge: null },
  },
  {
    id: 'pro-dentista-5',
    channel: 'professionals',
    slug: 'mi-visita-al-dentista',
    he: true,
    name: 'Gael',
    age: 5,
    likes: ['los autitos'],
    goal: 'prepararse para la primera visita al dentista',
  },
  {
    id: 'pro-calma-7',
    channel: 'professionals',
    slug: 'el-rincon-de-la-calma',
    name: 'Violeta',
    age: 7,
    likes: ['los gatos', 'armar rompecabezas'],
    goal: 'aprender a calmarse cuando algo la desborda',
  },
  {
    id: 'pro-triste-4',
    channel: 'professionals',
    slug: 'hoy-estoy-triste',
    he: true,
    name: 'Santino',
    age: 4,
    likes: ['los dinosaurios'],
    goal: 'poner nombre a la tristeza y pedir ayuda',
  },
];

/** Páginas modelo propias (inventadas por nosotros, sin copiar libros): muestran el oficio, no la trama. */
const MODEL_PAGES: Record<string, string> = {
  'hasta 4': `Ejemplo de la voz que buscamos (otra historia, otro personaje; NO copies su trama ni sus frases):
Página: «PLAF. El charco era más profundo de lo que parecía. Lola se miró las botas llenas de agua y dijo, bien despacito: —Ahora sí que son botas de pescador.»
Qué tiene: un sonido, un detalle concreto y absurdo, una frase que dice la protagonista, ninguna explicación de lo que muestra el dibujo.`,
  '5 a 8': `Ejemplo de la voz que buscamos (otra historia, otro personaje; NO copies su trama ni sus frases):
Página: «Nico apretó la linterna con las dos manos. La cueva respiraba: un soplido frío, una pausa, otro soplido. —No es un monstruo —se dijo—. Es el viento que busca la salida. Y entonces se le ocurrió algo: si el viento sabía el camino, solo tenía que seguirlo.»
Qué tiene: una imagen sensorial, una duda del protagonista que él mismo resuelve, un detalle plantado que servirá después.`,
  '9 o más': `Ejemplo de la voz que buscamos (otra historia, otro personaje; NO copies su trama ni sus frases):
Página: «El mapa tenía una esquina quemada, justo donde debía estar el puerto. Ana lo dobló despacio. Faltaba una pista, y la única persona que podía tener la otra mitad era la que menos quería ver.»
Qué tiene: frases de largo variado, una tensión concreta y una decisión que empuja a la página siguiente, sin adjetivos genéricos.`,
};
const modelPageFor = (age: number) =>
  age <= 4 ? MODEL_PAGES['hasta 4'] : age <= 8 ? MODEL_PAGES['5 a 8'] : MODEL_PAGES['9 o más'];

const CRITERIA = [
  'voz: ritmo y frases para leer en voz alta, vocabulario justo para la edad',
  'concreción: detalles sensoriales y específicos, sin adjetivos genéricos ni clichés',
  'arco: gancho en la primera página, desafío real resuelto por el protagonista, final que deja una imagen',
  'personalización: los gustos y datos del niño cambian la acción, no son relleno',
  'edad: tema, conflicto y largo adecuados a la edad (sin fórmulas de bebé en mayores ni miedo en menores)',
  'seguridad: sin contacto físico con no familiares, sin narración en segunda persona, sin imitación de riesgos, sin burlas ni diagnósticos',
  'escenas: la escena de cada página es dibujable, con un solo momento y emoción visible',
] as const;

const ids = values.only?.split(',');
const cases = ids ? CASES.filter((item) => ids.includes(item.id)) : CASES;
const variants = values.variants.split(',').map((item) => item.trim());
const missing = cases.filter(
  (item) =>
    ![...SEED_STORIES, ...SEED_NEW_STORIES, ...SEED_PRO_STORIES, ...SEED_DRAFT_STORIES].some(
      (story) => story.slug === item.slug,
    ),
);
if (missing.length > 0) {
  console.error(`Historias que no existen: ${missing.map((item) => item.slug).join(', ')}`);
  process.exit(1);
}
const runs = cases.length * variants.length;
const estimate = runs * 0.05;
const budget = Number(values.budget);
console.log(
  `Plan: ${String(cases.length)} casos × ${variants.join('/')} = ${String(runs)} corridas (plan, cuento, escenas y juez)`,
);
console.log(`Costo estimado: USD ${estimate.toFixed(2)} · tope: USD ${budget.toFixed(2)}`);
if (!values.yes) {
  console.log('Sin --yes no se genera nada.');
  process.exit(0);
}
if (estimate > budget) {
  console.error('La estimación supera el tope: bajá los casos o las variantes.');
  process.exit(1);
}

/** El token de gcloud dura una hora: se renueva cada 20 minutos (la corrida anterior se cortó con 401). */
let cachedToken = { value: '', at: 0 };
const freshToken = () => {
  if (!cachedToken.value || Date.now() - cachedToken.at > 20 * 60_000) {
    cachedToken = {
      value: execFileSync('gcloud', ['auth', 'print-access-token'], {
        env: { ...process.env, CLOUDSDK_ACTIVE_CONFIG_NAME: 'storynido' },
      })
        .toString()
        .trim(),
      at: Date.now(),
    };
  }
  return cachedToken.value;
};

/** Cliente que baja la temperatura del cuento (la llamada con 0,9) cuando la variante lo pide. */
class TunedClient extends VertexClient {
  storyTemperature: number | null = null;
  override async generate(
    ...args: Parameters<VertexClient['generate']>
  ): ReturnType<VertexClient['generate']> {
    const [model, parts, config, options] = args;
    const tuned =
      this.storyTemperature !== null && config.temperature === 0.9
        ? { ...config, temperature: this.storyTemperature }
        : config;
    return super.generate(model, parts, tuned, options);
  }
}
const client = new TunedClient({
  projectId: values.project,
  models: () => ({ text: 'gemini-3.5-flash', image: 'gemini-3.1-flash-image' }),
  getAccessToken: () => Promise.resolve(freshToken()),
});
const text = new VertexTextProvider(client);

const JUDGE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    scores: { type: 'ARRAY', items: { type: 'INTEGER' } },
    worst: { type: 'STRING' },
    best: { type: 'STRING' },
  },
  required: ['scores', 'worst', 'best'],
};

let spent = 0;
const stories = [...SEED_STORIES, ...SEED_NEW_STORIES, ...SEED_PRO_STORIES, ...SEED_DRAFT_STORIES];

interface Row {
  id: string;
  variant: string;
  title: string;
  pages: string[];
  scenes: string[];
  scores: number[];
  avg: number;
  overCap: number;
  worst: string;
  best: string;
  error?: string;
}
const resumed: Row[] = values.resume
  ? (JSON.parse(readFileSync(path.resolve(values.resume), 'utf8')) as Row[]).filter(
      (row) => !row.error,
    )
  : [];
const rows: Row[] = [...resumed];
const outDir = values.resume
  ? path.dirname(path.resolve(values.resume))
  : path.resolve(values.out, `golden-${new Date().toISOString().replace(/[:.]/g, '-')}`);
mkdirSync(outDir, { recursive: true });
const save = () => {
  writeFileSync(path.join(outDir, 'resultados.json'), JSON.stringify(rows, null, 2));
};
const done = (id: string, variant: string) =>
  existsSync(outDir) && resumed.some((row) => row.id === id && row.variant === variant);

for (const testCase of cases) {
  const story = stories.find((item) => item.slug === testCase.slug);
  if (!story) {
    console.log(`✗ ${testCase.id}: historia desconocida (${testCase.slug}), se saltea`);
    continue;
  }
  const plan = editorialPlan(
    { length: null, textDensity: 'balanced', readingLevel: 'developing', contentType: 'story' },
    DEFAULT_EDITORIAL_CONFIG,
    story.pageCount,
    testCase.age,
  );
  const request = {
    language: 'es' as const,
    childName: testCase.name,
    age: testCase.age,
    pronouns: testCase.he ? ('he' as const) : ('she' as const),
    likes: testCase.likes,
    petName: null,
    bestFriendName: null,
    dedication: null,
    storyTitle: story.title.es,
    lessons: [],
    // Tope de 10 páginas: el largo real lo elige el cliente; acá importa comparar prompts, no el largo.
    pageCount: Math.min(Math.max(plan.narrativePages, 4), 10),
    wordsPerPage: plan.words,
    mustInclude: [],
    spanishVoice: spanishVoiceFor('AR'),
  };
  const event = testCase.event ? { ...EMPTY_BIRTHDAY, ...testCase.event } : null;
  const input: StoryPromptInput = {
    ...request,
    template: story.textPromptTemplate,
    event,
    goal: testCase.goal ?? null,
    levelGuidance: plan.levelGuidance,
  };

  for (const variant of variants) {
    if (done(testCase.id, variant)) continue;
    const row: Row = {
      id: testCase.id,
      variant,
      title: '',
      pages: [],
      scenes: [],
      scores: [],
      avg: 0,
      overCap: 0,
      worst: '',
      best: '',
    };
    rows.push(row);
    try {
      if (spent / 1_000_000 >= budget) throw new Error('tope de presupuesto alcanzado');
      client.storyTemperature = variant === 't08' ? 0.8 : null;
      const extra = variant === 'modelo' ? `\n\n${modelPageFor(testCase.age)}` : '';
      const { usage: planUsage, ...storyPlan } = await text.planStory({
        ...request,
        prompt: `${buildStoryPrompt(input)}${extra}`,
      });
      const written = await text.generateStory({
        ...request,
        prompt: `${buildStoryPrompt({ ...input, plan: storyPlan })}${extra}`,
      });
      const scenes = await text.describeScenes({
        childName: testCase.name,
        pages: written.pages,
        scenes: storyPlan.scenes,
        recurring: [],
        age: testCase.age,
      });
      spent += planUsage.costUsdMicros + written.usage.costUsdMicros + scenes.usage.costUsdMicros;
      row.title = written.title;
      row.pages = written.pages.map((page) => page.text);
      row.scenes = scenes.prompts;
      row.overCap = pagesOverCap(written.pages, plan.words).length;

      const { response, usage } = await client.generate(
        values.judge,
        [
          {
            text: `Sos una editora de literatura infantil exigente e imparcial. Puntuá este cuento personalizado para ${testCase.name} (${String(testCase.age)} años, línea ${testCase.channel}) del 1 al 5 en cada criterio, en este orden:
${CRITERIA.map((item, index) => `${String(index + 1)}. ${item}`).join('\n')}
5 = ejemplar, 4 = bueno, 3 = correcto pero genérico, 2 = flojo, 1 = falla. Devolvé "scores" con siete enteros, "worst" con el problema más serio en una frase y "best" con lo mejor en una frase.

Las páginas con texto vacío son intencionales (el dibujo cuenta solo): no las penalices.\n\nPedido: ${JSON.stringify({ gustos: testCase.likes, objetivo: testCase.goal ?? null, evento: event?.type ?? null })}
Cuento (JSON): ${JSON.stringify({ title: written.title, pages: row.pages })}
Escenas para ilustrar (en orden): ${JSON.stringify(row.scenes)}`,
          },
        ],
        { temperature: 0, responseMimeType: 'application/json', responseSchema: JUDGE_SCHEMA },
      );
      spent += usage.costUsdMicros;
      const raw = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
      const judged = JSON.parse(raw) as { scores?: number[]; worst?: string; best?: string };
      row.scores = (judged.scores ?? []).slice(0, CRITERIA.length);
      row.avg = row.scores.length
        ? row.scores.reduce((sum, score) => sum + score, 0) / row.scores.length
        : 0;
      row.worst = judged.worst ?? '';
      row.best = judged.best ?? '';
      console.log(`✓ ${testCase.id} · ${variant} · promedio ${row.avg.toFixed(2)}`);
    } catch (error) {
      row.error = (error as Error).message.slice(0, 200);
      console.log(`✗ ${testCase.id} · ${variant}: ${row.error}`);
    }
    save();
  }
}

save();

const mean = (items: number[]) =>
  items.length ? items.reduce((sum, item) => sum + item, 0) / items.length : 0;
const summary = variants.map((variant) => {
  const done = rows.filter((row) => row.variant === variant && !row.error);
  return {
    variant,
    corridas: done.length,
    promedio: mean(done.map((row) => row.avg)),
    porCriterio: CRITERIA.map((_, index) => mean(done.map((row) => row.scores[index] ?? 0))),
    conUnUno: done.filter((row) => row.scores.includes(1)).length,
    paginasLargas: done.reduce((sum, row) => sum + row.overCap, 0),
    palabras: mean(done.map((row) => mean(row.pages.map(countWords)))),
  };
});
const md = [
  `# Golden set de texto · ${new Date().toISOString().slice(0, 10)}`,
  '',
  `Costo real: USD ${(spent / 1_000_000).toFixed(2)} · juez: ${values.judge}`,
  '',
  `| Variante | Corridas | Promedio | ${CRITERIA.map((item) => item.split(':')[0]).join(' | ')} | Con un 1 | Págs. largas |`,
  `| --- | --- | --- | ${CRITERIA.map(() => '---').join(' | ')} | --- | --- |`,
  ...summary.map(
    (item) =>
      `| ${item.variant} | ${String(item.corridas)} | ${item.promedio.toFixed(2)} | ${item.porCriterio.map((score) => score.toFixed(2)).join(' | ')} | ${String(item.conUnUno)} | ${String(item.paginasLargas)} |`,
  ),
  '',
  '## Peor y mejor de cada corrida',
  ...rows
    .filter((row) => !row.error)
    .map(
      (row) =>
        `- ${row.id} · ${row.variant} · ${row.avg.toFixed(2)} · peor: ${row.worst} · mejor: ${row.best}`,
    ),
].join('\n');
writeFileSync(path.join(outDir, 'resumen.md'), md);
console.log(md.split('\n').slice(0, 12).join('\n'));
console.log(`Reporte: ${outDir}`);
