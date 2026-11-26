/**
 * Juez comprador sobre los últimos pedidos reales (25 nov 2026, Sebas: «pasa el juez por todos los
 * últimos pedidos»). Lee los pedidos terminados de Firestore, baja la tapa y las páginas revisadas,
 * arma cada página como la ve el cliente (page-layout.ts, misma geometría que el PDF) y la pasa por la
 * mesa de jueces (judge-panel.ts, 26 nov): comprador con ventas y marketing, continuidad contra las
 * láminas, el chico que escucha y, en Profesionales, el profesional.
 *
 *   pnpm judge:pedidos --project storynido-staging            # solo lista y estima
 *   pnpm judge:pedidos --project storynido-prod --limit 20 --yes
 *
 * El informe queda en eval-reports/ (fuera del repo): tiene textos y dibujos de chicos reales, así
 * que no se sube ni se comparte; para la mesa se resume sin nombres. La IA corre en el mismo proyecto
 * que los datos. Credenciales: gcloud con la configuración "storynido".
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  countWords,
  pageLayout,
  panelLines,
  panelSummary,
  runPanel,
  storyTypography,
  type Panel,
  type AgeBand,
  type BookLayout,
  type ImageData,
  type PageLayout,
} from '@storynido/shared';
import sharp from 'sharp';

import { VertexClient, VertexTextProvider } from '../src/gcp/vertex';
import { composePage } from '../src/compose-page';

const { values } = parseArgs({
  options: {
    project: { type: 'string', default: 'storynido-staging' },
    limit: { type: 'string', default: '15' },
    /** Páginas armadas por libro que mira el juez (todas cuestan más y no cambian el veredicto). */
    pages: { type: 'string', default: '8' },
    only: { type: 'string' },
    budget: { type: 'string', default: '2' },
    out: { type: 'string', default: 'eval-reports' },
    yes: { type: 'boolean', default: false },
  },
});

if (values.project.startsWith('timbermap')) {
  console.error('Este script nunca corre contra proyectos de Timbermap.');
  process.exit(1);
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

const project = values.project;
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const bucket = `${project}-generated-assets`;

type FsValue = Record<string, unknown>;
/** Valor de la API REST de Firestore a JSON común. */
function decode(value: FsValue): unknown {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) {
    const items = (value.arrayValue as { values?: FsValue[] }).values ?? [];
    return items.map(decode);
  }
  if ('mapValue' in value)
    return decodeFields((value.mapValue as { fields?: Record<string, FsValue> }).fields);
  return null;
}
const decodeFields = (fields: Record<string, FsValue> | undefined) =>
  Object.fromEntries(Object.entries(fields ?? {}).map(([key, item]) => [key, decode(item)]));

async function api(url: string, init: { method?: string; body?: string } = {}): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${freshToken()}`,
      'x-goog-user-project': project,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error(`${String(response.status)} ${url.slice(0, 120)}`);
  return response;
}

const getDoc = async (docPath: string) => {
  const json = (await (await api(`${base}/${docPath}`)).json()) as {
    fields?: Record<string, FsValue>;
  };
  return decodeFields(json.fields);
};

const download = async (objectPath: string): Promise<Uint8Array> =>
  new Uint8Array(
    await (
      await api(
        `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media`,
      )
    ).arrayBuffer(),
  );

interface Snapshot {
  title: string;
  age: number;
  language: string;
  contentType: string;
  ageBand?: AgeBand;
  textBand?: AgeBand;
  dedication: string | null;
  requiredNames: string[];
  pages: { index: number; text: string }[];
  scenes: { pageIndex: number }[] | null;
  stylePrompt: string;
  companion?: { name: string; sheetPath?: string } | null;
  character?: { sheetPath?: string };
  pageLayout?: BookLayout | null;
}

/** Pedidos terminados, del más nuevo al más viejo. */
const FINISHED = new Set(['ready', 'sent_to_print', 'in_production', 'shipped', 'delivered']);
const query = await (
  await api(`${base}:runQuery`, {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'orders' }],
        orderBy: [{ field: { fieldPath: 'updatedAt' }, direction: 'DESCENDING' }],
        limit: 200,
      },
    }),
  })
).json();
const only = values.only?.split(',');
const orders = (query as { document?: { name: string; fields: Record<string, FsValue> } }[])
  .filter((item) => item.document)
  .map((item) => ({
    id: item.document?.name.split('/').pop() ?? '',
    ...(decodeFields(item.document?.fields) as {
      status: string;
      channel?: string;
      currency: string;
      amounts?: { totalMinor: number };
      updatedAt: string;
      snapshot?: Snapshot;
      payment?: { provider: string };
    }),
  }))
  .filter((order) => (only ? only.includes(order.id) : FINISHED.has(order.status)))
  .filter((order) => order.snapshot?.contentType !== 'coloring')
  .slice(0, Number(values.limit));

const pagesToJudge = Number(values.pages);
const estimate = orders.length * 0.06;
console.log(
  `${String(orders.length)} pedidos terminados en ${project} · estimado USD ${estimate.toFixed(2)} (tope ${values.budget})`,
);
for (const order of orders) {
  console.log(
    `- ${order.id} · ${order.channel ?? 'families'} · ${order.status} · ${order.updatedAt}`,
  );
}
if (!values.yes) {
  console.log('Agregá --yes para correr el juez.');
  process.exit(0);
}

const client = new VertexClient({
  projectId: project,
  models: () => ({ text: 'gemini-3.5-flash', image: 'gemini-3.1-flash-image' }),
  getAccessToken: () => Promise.resolve(freshToken()),
});
const text = new VertexTextProvider(client);

const outDir = path.resolve(
  values.out,
  `comprador-${project}-${new Date().toISOString().replace(/[:.]/g, '-')}`,
);
mkdirSync(outDir, { recursive: true });

let spent = 0;
interface Row {
  id: string;
  channel: string;
  updatedAt: string;
  panel?: Panel;
  error?: string;
}
const rows: Row[] = [];

for (const order of orders) {
  const channel = (
    ['professionals', 'events'].includes(order.channel ?? '') ? order.channel : 'families'
  ) as 'families' | 'professionals' | 'events';
  const row: Row = { id: order.id, channel, updatedAt: order.updatedAt };
  rows.push(row);
  try {
    const snapshot = order.snapshot;
    if (!snapshot) throw new Error('sin libro congelado');
    const step = await getDoc(`orders/${order.id}/steps/quality_check`);
    const output = step.output as { images?: { index: number; imagePath: string }[] } | null;
    const images = output?.images ?? [];
    const byIndex = new Map(images.map((item) => [item.index, item.imagePath]));
    const coverPath = byIndex.get(0);
    if (!coverPath) throw new Error('sin tapa revisada');
    const cover: ImageData = { bytes: await download(coverPath), mimeType: 'image/webp' };
    const typography =
      snapshot.ageBand && snapshot.textBand
        ? storyTypography(snapshot.ageBand, snapshot.textBand, snapshot.language as 'es')
        : null;
    const composed: ImageData[] = [];
    const drawn: ImageData[] = [];
    for (const [index, page] of snapshot.pages.slice(0, pagesToJudge).entries()) {
      const imagePath = byIndex.get(index + 1);
      if (!imagePath) continue;
      // El mismo armado que el worker (layoutOf): sin armado por edad, la página va entera.
      const layout: PageLayout = pageLayout({
        layout: snapshot.pageLayout,
        words: countWords(page.text),
        text: page.text,
        typography,
        pageIndex: snapshot.scenes?.[index]?.pageIndex ?? page.index,
        contentType: snapshot.contentType,
      });
      const raw = await download(imagePath);
      drawn.push({ bytes: raw, mimeType: 'image/webp' });
      const bytes = await composePage(raw, layout, page.text, typography);
      await sharp(bytes).toFile(path.join(outDir, `${order.id}-pagina-${String(index + 1)}.webp`));
      composed.push({ bytes, mimeType: 'image/webp' });
    }
    const totalUsd =
      order.currency === 'USD' && order.amounts?.totalMinor ? order.amounts.totalMinor / 100 : 15;
    const sheet = async (sheetPath: string | undefined): Promise<ImageData | null> =>
      sheetPath ? { bytes: await download(sheetPath), mimeType: 'image/webp' } : null;
    const panel = await runPanel(
      text,
      {
        channel,
        priceUsd: totalUsd,
        order: [
          `Libro: ${snapshot.title}`,
          `Protagonista de ${String(snapshot.age)} años`,
          snapshot.requiredNames.length > 0
            ? `Nombres pedidos: ${snapshot.requiredNames.join(', ')}`
            : null,
          snapshot.companion ? `Acompañante pedido: ${snapshot.companion.name}` : null,
          snapshot.dedication ? `Dedicatoria: ${snapshot.dedication}` : null,
          `Estilo elegido: ${snapshot.stylePrompt.slice(0, 300)}`,
        ]
          .filter(Boolean)
          .join('\n'),
        title: snapshot.title,
        texts: snapshot.pages.map((page) => page.text),
        age: snapshot.age,
        language: snapshot.language,
        style: snapshot.stylePrompt.slice(0, 300),
        cover,
        composed,
        drawn,
        reference: await sheet(snapshot.character?.sheetPath),
        companionReference: await sheet(snapshot.companion?.sheetPath),
        companion: snapshot.companion?.name ?? null,
      },
      (usage) => {
        spent += usage.costUsdMicros;
      },
    );
    row.panel = panel;
    console.log(
      `✓ ${order.id}: mesa ${String(panel.score ?? '-')}/5 (la baja ${panel.weakest ?? '-'})`,
    );
  } catch (error) {
    row.error = (error as Error).message.slice(0, 200);
    console.log(`✗ ${order.id}: ${row.error}`);
  }
  writeFileSync(path.join(outDir, 'resultados.json'), JSON.stringify(rows, null, 2));
  if (spent / 1_000_000 > Number(values.budget)) {
    console.log('Tope de presupuesto alcanzado.');
    break;
  }
}

const panels = rows.flatMap((row) => (row.panel ? [row.panel] : []));
const md = [
  `# Mesa de jueces · ${project} · ${new Date().toISOString().slice(0, 10)}`,
  '',
  `Costo: USD ${(spent / 1_000_000).toFixed(2)} · ${panels.length > 0 ? panelSummary(panels) : 'sin respuestas'}`,
  '',
  ...rows.flatMap((row) =>
    row.panel
      ? [...panelLines(`${row.id} (${row.channel}, ${row.updatedAt.slice(0, 10)})`, row.panel), '']
      : [`- **${row.id}**: sin juzgar (${row.error ?? '-'})`],
  ),
].join('\n');
writeFileSync(path.join(outDir, 'resumen.md'), md);
console.log(md);
console.log(`Reporte: ${outDir}`);
