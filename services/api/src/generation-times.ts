import {
  COLLECTIONS,
  addSample,
  generationTimesFrom,
  type GenerationKind,
  type GenerationTimes,
} from '@storynido/shared';
import type { Firestore } from 'firebase-admin/firestore';

/** Los tiempos cambian despacio: se releen como mucho cada 5 minutos por instancia. */
const CACHE_MS = 5 * 60 * 1000;

/**
 * Registro de cuánto tarda cada tipo de generación (generationTimings/{tipo}, DECISIONS 261).
 * Guardar nunca rompe la generación: si falla, se pierde una muestra y listo.
 */
export class GenerationTimings {
  private cache: { at: number; times: GenerationTimes } | null = null;

  constructor(private readonly db: Firestore) {}

  async times(): Promise<GenerationTimes> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.times;
    const snap = await this.db.collection(COLLECTIONS.generationTimings).get();
    const times = generationTimesFrom(
      snap.docs.map((doc) => ({
        kind: doc.id,
        samples: doc.get('samples') as number[] | undefined,
      })),
    );
    this.cache = { at: Date.now(), times };
    return times;
  }

  async record(kind: GenerationKind, durationMs: number): Promise<void> {
    const ref = this.db.collection(COLLECTIONS.generationTimings).doc(kind);
    try {
      await this.db.runTransaction(async (tx) => {
        const current = (await tx.get(ref)).get('samples') as number[] | undefined;
        tx.set(ref, { kind, samples: addSample(current, durationMs), updatedAt: new Date() });
      });
      this.cache = null;
    } catch {
      // Es solo un dato para el estimado: no vale la pena fallar por esto.
    }
  }

  /** Mide desde `startedAt` (milisegundos, Date o Timestamp de Firestore) y lo guarda. */
  async track(kind: GenerationKind, startedAt: unknown): Promise<void> {
    const start = millisOf(startedAt);
    if (start === null) return;
    await this.record(kind, Date.now() - start);
  }
}

function millisOf(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object' && 'toMillis' in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}
