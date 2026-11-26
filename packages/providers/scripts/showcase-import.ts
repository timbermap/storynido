/**
 * Libros de ejemplo de la mesa (DECISIONS 348): sube a Storage y a Firestore los libros de una
 * corrida de eval:pedidos que pasan la mesa (golden set, nota 4 o más, el comprador lo compraría y
 * sin fallas duras). Quedan «por aprobar»: Sebas los mira y los aprueba en el admin
 * (Contenido → Ejemplos de la mesa) antes de que se vean en la web. Se suben tal cual salieron.
 *
 *   pnpm showcase:import eval-reports/pedidos-…               # solo lista qué califica
 *   pnpm showcase:import eval-reports/pedidos-… --yes         # sube a storynido-staging
 *   pnpm showcase:import eval-reports/pedidos-… --only pro-sonido-3 --project storynido-prod --yes
 *
 * Solo chicos inventados del golden set: nunca pedidos reales ni fotos. No cuesta IA.
 * Credenciales: gcloud con la configuración "storynido".
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  JUDGE_NAMES,
  showcaseFilePath,
  showcaseReasons,
  type Panel,
  type ShowcaseBook,
} from '@storynido/shared';

import { CASES } from './pedidos-cases';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    project: { type: 'string', default: 'storynido-staging' },
    only: { type: 'string' },
    yes: { type: 'boolean', default: false },
  },
});

const reportDir = positionals[0];
if (!reportDir) {
  console.error('Uso: pnpm showcase:import <carpeta de la corrida de eval:pedidos> [--yes]');
  process.exit(1);
}
if (values.project.startsWith('timbermap')) {
  console.error('Este script nunca corre contra proyectos de Timbermap.');
  process.exit(1);
}

interface Row {
  id: string;
  run?: number;
  arm?: string;
  title: string;
  pages: string[];
  clauses: Record<string, string | undefined>;
  panel?: Panel;
  error?: string;
}

const rows = JSON.parse(readFileSync(path.join(reportDir, 'resultados.json'), 'utf8')) as Row[];
const report = path.basename(path.resolve(reportDir));
const runs = Math.max(1, ...rows.map((row) => row.run ?? 1));
const arms = new Set(rows.map((row) => row.arm ?? 'base'));

/** El prefijo de los archivos de la fila (el mismo que arma eval-pedidos). */
const tagOf = (row: Row) =>
  `${row.id}${runs > 1 ? `-v${String(row.run ?? 1)}` : ''}${arms.size > 1 ? `-${row.arm ?? 'base'}` : ''}`;

const goldenIds = CASES.map((item) => item.id);
const candidates = rows
  .filter((row) => !values.only || row.id === values.only)
  .map((row) => {
    const tag = tagOf(row);
    const files = {
      cover: path.join(reportDir, `${tag}-tapa.webp`),
      pages: row.pages.map((_, index) =>
        path.join(reportDir, `${tag}-pagina-${String(index + 1)}-armada.webp`),
      ),
    };
    const reasons = showcaseReasons({
      caseId: row.id,
      goldenIds,
      title: row.title,
      pages: row.pages,
      clauses: row.clauses,
      ...(row.error ? { error: row.error } : {}),
      panel: row.panel ?? null,
    });
    const missing = [files.cover, ...files.pages].filter((file) => !existsSync(file));
    if (missing.length > 0) reasons.push(`faltan ${String(missing.length)} imágenes`);
    return { row, tag, files, reasons };
  });

for (const { tag, row, reasons } of candidates) {
  const score = row.panel?.score ?? '-';
  console.log(
    `${reasons.length === 0 ? '✓' : '✗'} ${tag} · mesa ${String(score)}/5 · ${row.panel?.buyer?.verdict ?? '-'}${reasons.length > 0 ? ` · ${reasons.join('; ')}` : ''}`,
  );
}
const ready = candidates.filter((item) => item.reasons.length === 0);
console.log(`\n${String(ready.length)} de ${String(candidates.length)} califican.`);
if (!values.yes) {
  console.log('Nada subido. Con --yes se suben como «por aprobar» al admin.');
  process.exit(0);
}

const token = execFileSync('gcloud', ['auth', 'print-access-token'], {
  env: { ...process.env, CLOUDSDK_ACTIVE_CONFIG_NAME: 'storynido' },
})
  .toString()
  .trim();
const project = values.project;
const bucket = `${project}-generated-assets`;
const firestore = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;

/** JSON común a la forma de la API REST de Firestore. */
function encode(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
          key,
          encode(inner),
        ]),
      ),
    },
  };
}

async function upload(name: string, file: string) {
  const response = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(name)}`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'image/webp' },
      body: readFileSync(file),
    },
  );
  if (!response.ok) throw new Error(`Storage ${String(response.status)}: ${await response.text()}`);
}

for (const { row, tag, files } of ready) {
  const testCase = CASES.find((item) => item.id === row.id);
  const panel = row.panel;
  if (!testCase || !panel) continue;
  // Un id por corrida y pedido: volver a subir la misma corrida pisa ese libro, no duplica.
  const id = `${report.replace(/^pedidos-/, '')}-${tag}`
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .slice(0, 120);
  const pages = files.pages.map((file, index) => ({
    file: `pagina-${String(index + 1)}.webp`,
    text: row.pages[index] ?? '',
    source: file,
  }));
  await upload(showcaseFilePath(id, 'tapa.webp'), files.cover);
  for (const page of pages) await upload(showcaseFilePath(id, page.file), page.source);
  const judges: Record<string, number> = {};
  if (panel.buyer) judges[JUDGE_NAMES.buyer] = panel.buyer.buy;
  if (panel.continuity) judges[JUDGE_NAMES.continuity] = panel.continuity.score;
  if (panel.child) judges[JUDGE_NAMES.child] = panel.child.score;
  if (panel.professional) judges[JUDGE_NAMES.professional] = panel.professional.score;
  const book: ShowcaseBook = {
    storySlug: testCase.story,
    channel: testCase.channel,
    locale: 'es',
    title: row.title,
    childName: testCase.name,
    age: testCase.age,
    styleSlug: testCase.style,
    cover: 'tapa.webp',
    pages: pages.map(({ file, text }) => ({ file, text })),
    panel: {
      score: panel.score,
      weakest: panel.weakest,
      verdict: panel.buyer?.verdict ?? null,
      buy: panel.buyer?.buy ?? null,
      judges,
      loved: panel.buyer?.loved ?? [],
    },
    source: { report, caseId: row.id, run: row.run ?? 1, arm: row.arm ?? null },
    eligible: true,
    reasons: [],
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date(),
  };
  const response = await fetch(`${firestore}/showcaseBooks/${id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      fields: (encode(book) as { mapValue: { fields: unknown } }).mapValue.fields,
    }),
  });
  if (!response.ok) {
    throw new Error(`Firestore ${String(response.status)}: ${await response.text()}`);
  }
  console.log(`subido ${id} (${String(pages.length)} páginas) → admin, por aprobar`);
}
