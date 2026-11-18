/* eslint-disable no-console -- script de línea de comandos: el resultado se lee en la consola. */
/**
 * Mide cuánto tardaron las generaciones reales de un ambiente y, con --write, carga esas
 * duraciones en generationTimings (DECISIONS 262) para que el tiempo estimado arranque con datos.
 *
 * - Libro completo: exacto, de orders/{id}/steps (durationMs) y del pipeline (inicio → fin).
 * - Muestras, ilustraciones, regeneraciones y dibujos del perfil: aproximado, con las llamadas de
 *   IA de aiUsage (de la primera a la última de cada tanda, separadas por pausas de 3 minutos).
 *
 * Uso (credenciales de gcloud del ambiente, application-default):
 *   GCP_PROJECT_ID=storynido-staging pnpm --filter @storynido/worker exec tsx scripts/seed-generation-times.ts [--days=60] [--write]
 */
import {
  COLLECTIONS,
  MAX_SAMPLES,
  PIPELINE_STEPS,
  addSample,
  bookStepKind,
  summarizeSamples,
  type GenerationKind,
} from '@storynido/shared';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.GCP_PROJECT_ID;
if (!projectId) throw new Error('Falta GCP_PROJECT_ID (por ejemplo storynido-staging).');
const write = process.argv.includes('--write');
const daysArg = process.argv.find((arg) => arg.startsWith('--days='));
const days = daysArg ? Number(daysArg.slice('--days='.length)) : 60;
/** Una pausa más larga que esta entre llamadas de IA corta la tanda. */
const GAP_MS = 3 * 60 * 1000;

const db = getFirestore(initializeApp({ projectId }));
const samples = new Map<GenerationKind, number[]>();
const add = (kind: GenerationKind, durationMs: number) => {
  samples.set(kind, addSample(samples.get(kind), durationMs));
};

function dateOf(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate(): Date }).toDate();
  }
  return null;
}

// ------------------------------------------------------------------ libro completo
const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const orders = await db.collection(COLLECTIONS.orders).where('createdAt', '>=', since).get();
let books = 0;
for (const order of orders.docs) {
  const startedAt = dateOf(order.get('pipeline.startedAt'));
  const finishedAt = dateOf(order.get('pipeline.finishedAt'));
  const status = order.get('status') as string;
  const generation = (order.get('pipeline.generation') as number | undefined) ?? 0;
  if (!startedAt) continue;
  const steps = await order.ref.collection(COLLECTIONS.orderSteps).get();
  for (const step of steps.docs) {
    if (!(PIPELINE_STEPS as readonly string[]).includes(step.id)) continue;
    if (step.get('status') !== 'succeeded' || step.get('generation') !== generation) continue;
    const duration = step.get('durationMs') as number | null;
    if (typeof duration === 'number') {
      add(bookStepKind(step.id as (typeof PIPELINE_STEPS)[number]), duration);
    }
  }
  if (finishedAt && status !== 'qa_failed' && status !== 'generating') {
    add('book', finishedAt.getTime() - startedAt.getTime());
    books += 1;
  }
}

// --------------------------------------------- muestras y dibujos (aproximado, por aiUsage)
interface Call {
  at: number;
  kind: string;
}
const usage = await db.collection(COLLECTIONS.aiUsage).where('at', '>=', since).get();
const byBook = new Map<string, Call[]>();
const byOwner = new Map<string, Call[]>();
for (const doc of usage.docs) {
  if (doc.get('orderId')) continue; // el pipeline del libro ya está medido arriba
  const at = dateOf(doc.get('at'));
  if (!at) continue;
  const call = { at: at.getTime(), kind: doc.get('kind') as string };
  const bookId = doc.get('bookId') as string | null;
  const owner = doc.get('ownerUid') as string | null;
  if (bookId) byBook.set(bookId, [...(byBook.get(bookId) ?? []), call]);
  else if (owner) byOwner.set(owner, [...(byOwner.get(owner) ?? []), call]);
}

function sessions(calls: Call[]): Call[][] {
  const sorted = [...calls].sort((a, b) => a.at - b.at);
  const out: Call[][] = [];
  for (const call of sorted) {
    const last = out.at(-1);
    const previous = last?.at(-1);
    if (last && previous && call.at - previous.at <= GAP_MS) last.push(call);
    else out.push([call]);
  }
  return out;
}

const span = (calls: Call[]) => (calls.at(-1)?.at ?? 0) - (calls[0]?.at ?? 0);
const count = (calls: Call[], kind: string) => calls.filter((call) => call.kind === kind).length;

for (const calls of byBook.values()) {
  for (const session of sessions(calls)) {
    const story = count(session, 'story');
    const images = count(session, 'illustration');
    if (story > 0 && images === 1) add('preview', span(session));
    else if (story > 0 && images === 0) add('preview_story', span(session));
    else if (story === 0 && images >= 3) add('illustrate', span(session));
    else if (story === 0 && images === 1) add('regenerate', span(session));
    // Lo demás (texto e ilustraciones juntos, tandas cortadas) es ambiguo: no se usa.
  }
}
for (const calls of byOwner.values()) {
  for (const session of sessions(calls)) {
    if (count(session, 'illustration') === 1 && count(session, 'story') === 0) {
      add('child_drawing', span(session));
    }
  }
}

// ------------------------------------------------------------------- resultado
console.log(
  `Proyecto ${projectId}, últimos ${String(days)} días, ${String(books)} libros completos.`,
);
console.log('tipo                          n   mediana   p80   (s)');
for (const [kind, list] of [...samples.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const summary = summarizeSamples(kind, list);
  console.log(
    `${kind.padEnd(28)} ${String(list.length).padStart(3)} ${String(summary.typicalSeconds).padStart(8)} ${String(summary.slowSeconds).padStart(6)}${list.length < 3 ? '  (pocos datos: queda el valor de partida)' : ''}`,
  );
}

if (write) {
  for (const [kind, list] of samples) {
    const ref = db.collection(COLLECTIONS.generationTimings).doc(kind);
    await db.runTransaction(async (tx) => {
      // Lo medido en vivo es exacto: va al final (es lo que se conserva si sobran).
      const live = ((await tx.get(ref)).get('samples') as number[] | undefined) ?? [];
      tx.set(ref, {
        kind,
        samples: [...list, ...live].slice(-MAX_SAMPLES),
        updatedAt: new Date(),
      });
    });
  }
  console.log(`Guardado en ${COLLECTIONS.generationTimings} (${String(samples.size)} tipos).`);
} else {
  console.log('Solo lectura. Con --write se cargan en generationTimings.');
}
