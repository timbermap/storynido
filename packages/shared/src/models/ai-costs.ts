import type { AiUsageRecord } from './config';

export interface CostStats {
  count: number;
  avgUsd: number;
  p50Usd: number;
  p95Usd: number;
}

export interface AiCostReport {
  /** Por modelo: llamadas y costo total (estimado con el precio vigente al momento de cada llamada). */
  byModel: { provider: string; model: string; calls: number; totalUsd: number }[];
  /** Costo real por muestra (llamadas sin pedido, agrupadas por libro), según el modelo de imagen. */
  perPreview: ({ imageModel: string } & CostStats)[];
  /** Costo real por libro final (llamadas del pedido), según el modelo de imagen. */
  perBook: ({ imageModel: string } & CostStats)[];
}

type Usage = Pick<
  AiUsageRecord,
  'kind' | 'provider' | 'model' | 'costUsdMicros' | 'bookId' | 'orderId'
>;

/** Percentil por el método del rango más cercano (sobre valores ya ordenados). */
function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1] ?? 0;
}

const usd = (micros: number) => Math.round(micros / 10_000) / 100;

function stats(totalsMicros: readonly number[]): CostStats {
  const sorted = [...totalsMicros].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    count: sorted.length,
    avgUsd: sorted.length ? usd(sum / sorted.length) : 0,
    p50Usd: usd(percentile(sorted, 50)),
    p95Usd: usd(percentile(sorted, 95)),
  };
}

/** Agrupa las llamadas por muestra o libro y resume el costo según el modelo de imagen usado. */
function grouped(records: readonly Usage[], key: (record: Usage) => string | null) {
  const groups = new Map<string, { micros: number; imageModel: string }>();
  for (const record of records) {
    const id = key(record);
    if (!id) continue;
    const group = groups.get(id) ?? { micros: 0, imageModel: 'sin imagen' };
    group.micros += record.costUsdMicros;
    if (record.kind === 'illustration' || record.kind === 'character') {
      group.imageModel = `${record.provider}/${record.model}`;
    }
    groups.set(id, group);
  }
  const byModel = new Map<string, number[]>();
  for (const group of groups.values()) {
    byModel.set(group.imageModel, [...(byModel.get(group.imageModel) ?? []), group.micros]);
  }
  return [...byModel]
    .map(([imageModel, totals]) => ({ imageModel, ...stats(totals) }))
    .sort((a, b) => b.count - a.count);
}

/** Costo real de IA a partir de aiUsage (dashboard del admin, fase 14). */
export function aiCostReport(records: readonly Usage[]): AiCostReport {
  const models = new Map<
    string,
    { provider: string; model: string; calls: number; micros: number }
  >();
  for (const record of records) {
    const id = `${record.provider}/${record.model}`;
    const entry = models.get(id) ?? {
      provider: record.provider,
      model: record.model,
      calls: 0,
      micros: 0,
    };
    entry.calls += 1;
    entry.micros += record.costUsdMicros;
    models.set(id, entry);
  }
  return {
    byModel: [...models.values()]
      .map(({ micros, ...entry }) => ({ ...entry, totalUsd: usd(micros) }))
      .sort((a, b) => b.totalUsd - a.totalUsd),
    perPreview: grouped(records, (record) => (record.orderId ? null : record.bookId)),
    perBook: grouped(records, (record) => record.orderId),
  };
}
