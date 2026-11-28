/**
 * Mesa de jueces sobre una corrida del golden set ya hecha (26 nov 2026, Sebas: «esa mesa quiero
 * que vea el set 3»). No dibuja ni escribe nada: lee los dibujos y los textos que dejó eval-pedidos
 * en su carpeta, arma cada página como la ve el cliente y la pasa por la mesa (judge-panel.ts).
 * Usa el dibujo final de cada página (el redibujo, si lo hubo).
 *
 *   pnpm judge:ronda --dir eval-reports/pedidos-…            # solo estima
 *   pnpm judge:ronda --dir eval-reports/pedidos-… --yes      # corre (centavos por libro)
 *
 * Los chicos del golden set son inventados. Credenciales: gcloud con la configuración "storynido".
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  DEFAULT_EDITORIAL_CONFIG,
  bookLayout,
  countWords,
  editorialPlan,
  pageLayout,
  panelLines,
  panelSummary,
  runPanel,
  storyTypography,
  type ImageData,
  type Panel,
  textOwnBandLayout,
} from '@storynido/shared';

import {
  SEED_DRAFT_STORIES,
  SEED_NEW_STORIES,
  SEED_PRO_STORIES,
  SEED_STORIES,
  SEED_STYLES,
} from '../../../firebase/seed-data/catalog';
import { composePage } from '../src/compose-page';
import { VertexClient, VertexTextProvider } from '../src/gcp/vertex';
import { CASES, orderSummary } from './pedidos-cases';

const { values } = parseArgs({
  options: {
    dir: { type: 'string' },
    project: { type: 'string', default: 'storynido-staging' },
    budget: { type: 'string', default: '3' },
    yes: { type: 'boolean', default: false },
  },
});

if (!values.dir) {
  console.error('Falta --dir con la carpeta de la corrida (eval-reports/pedidos-…).');
  process.exit(1);
}
if (values.project.startsWith('timbermap')) {
  console.error('Este script nunca corre contra proyectos de Timbermap.');
  process.exit(1);
}

const dir = path.resolve(values.dir);
interface RoundRow {
  id: string;
  run?: number;
  title: string;
  pages: string[];
  scenes?: { pageIndex: number }[];
  error?: string;
}
const rows = (
  JSON.parse(readFileSync(path.join(dir, 'resultados.json'), 'utf8')) as RoundRow[]
).filter((row) => !row.error && row.pages.length > 0);
const runs = Math.max(1, ...rows.map((row) => row.run ?? 1));
const stories = [...SEED_STORIES, ...SEED_NEW_STORIES, ...SEED_PRO_STORIES, ...SEED_DRAFT_STORIES];

console.log(
  `${String(rows.length)} libros en ${dir} · estimado USD ${(rows.length * 0.06).toFixed(2)} (tope ${values.budget})`,
);
if (!values.yes) {
  console.log('Agregá --yes para correr la mesa.');
  process.exit(0);
}

let cachedToken = { value: '', at: 0 };
const freshToken = () => {
  if (!cachedToken.value || Date.now() - cachedToken.at > 2 * 60_000) {
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
const client = new VertexClient({
  projectId: values.project,
  models: () => ({ text: 'gemini-3.5-flash', image: 'gemini-3.1-flash-image' }),
  getAccessToken: () => Promise.resolve(freshToken()),
});
const text = new VertexTextProvider(client);

/** El dibujo final: el redibujo si lo hubo, si no el primero. */
const finalImage = (tag: string, file: string): ImageData | null => {
  for (const name of [`${tag}-${file}-redibujo.webp`, `${tag}-${file}.webp`]) {
    const full = path.join(dir, name);
    if (existsSync(full))
      return { bytes: new Uint8Array(readFileSync(full)), mimeType: 'image/webp' };
  }
  return null;
};

let spent = 0;
const judged: { label: string; panel: Panel }[] = [];
for (const row of rows) {
  const testCase = CASES.find((item) => item.id === row.id);
  const story = stories.find((item) => item.slug === testCase?.story);
  const style = SEED_STYLES.find((item) => item.slug === testCase?.style);
  const tag = runs > 1 ? `${row.id}-v${String(row.run ?? 1)}` : row.id;
  const label = runs > 1 ? `${row.id} v${String(row.run ?? 1)}` : row.id;
  if (!testCase || !story || !style) {
    console.log(`✗ ${label}: el caso ya no está en el golden set`);
    continue;
  }
  const cover = finalImage(tag, 'tapa');
  const reference = finalImage(tag, 'lamina');
  if (!cover) {
    console.log(`✗ ${label}: sin tapa en la carpeta`);
    continue;
  }
  const plan = editorialPlan(
    { length: 'mini', textDensity: 'balanced', readingLevel: 'developing', contentType: 'story' },
    DEFAULT_EDITORIAL_CONFIG,
    story.pageCount,
    testCase.age,
  );
  const typography =
    plan.ageBand && plan.textBand ? storyTypography(plan.ageBand, plan.textBand, 'es') : null;
  const composed: ImageData[] = [];
  let textOwnBand = true;
  const drawn: ImageData[] = [];
  for (const [index, pageText] of row.pages.entries()) {
    const img = finalImage(tag, `pagina-${String(index + 1)}`);
    if (!img) continue;
    const layout = pageLayout({
      layout: bookLayout(testCase.age, 'story'),
      words: countWords(pageText),
      text: pageText,
      typography,
      pageIndex: row.scenes?.[index]?.pageIndex ?? index + 1,
      contentType: 'story',
    });
    drawn.push(img);
    if (!textOwnBandLayout(layout.kind)) textOwnBand = false;
    composed.push({
      bytes: await composePage(img.bytes, layout, pageText, typography),
      mimeType: 'image/webp',
    });
  }
  try {
    const panel = await runPanel(
      text,
      {
        channel: testCase.channel,
        priceUsd: testCase.channel === 'events' ? 11 : 15,
        order: orderSummary(testCase, story.title.es, style.name.es),
        goal: testCase.goal ?? null,
        title: row.title,
        texts: row.pages,
        age: testCase.age,
        language: 'es',
        style: `${style.name.es}: ${style.promptModifier.slice(0, 200)}`,
        cover,
        composed,
        textOwnBand: composed.length > 0 && textOwnBand,
        drawn,
        reference,
      },
      (usage) => {
        spent += usage.costUsdMicros;
      },
    );
    judged.push({ label, panel });
    console.log(
      `✓ ${label}: mesa ${String(panel.score ?? '-')}/5 (la baja ${panel.weakest ?? '-'})`,
    );
  } catch (error) {
    console.log(`✗ ${label}: ${(error as Error).message.slice(0, 160)}`);
  }
  writeFileSync(path.join(dir, 'mesa.json'), JSON.stringify(judged, null, 2));
  if (spent / 1_000_000 > Number(values.budget)) {
    console.log('Tope de presupuesto alcanzado.');
    break;
  }
}

const md = [
  `# Mesa de jueces · ${path.basename(dir)}`,
  '',
  `Costo: USD ${(spent / 1_000_000).toFixed(2)} · ${judged.length > 0 ? panelSummary(judged.map((item) => item.panel)) : 'sin respuestas'}`,
  '',
  ...judged.flatMap((item) => [...panelLines(item.label, item.panel), '']),
].join('\n');
writeFileSync(path.join(dir, 'mesa.md'), md);
console.log(md);
