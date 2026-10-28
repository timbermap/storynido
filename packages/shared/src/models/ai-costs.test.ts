import { describe, expect, it } from 'vitest';

import { aiCostReport } from './ai-costs';

const call = (
  kind: 'story' | 'illustration' | 'character' | 'moderation',
  costUsdMicros: number,
  bookId: string,
  orderId: string | null = null,
  model = kind === 'story' || kind === 'moderation' ? 'gemini-3.5-flash' : 'gemini-3.1-flash-image',
) => ({ kind, provider: 'vertex', model, costUsdMicros, bookId, orderId });

describe('costo real de IA', () => {
  it('por muestra y por libro, con promedio, p50 y p95 según el modelo de imagen', () => {
    const records = [
      // Muestra b1: USD 0,30; b2: USD 0,50; b3: USD 1,20 (todas con el mismo modelo de imagen).
      call('story', 100_000, 'b1'),
      call('character', 200_000, 'b1'),
      call('story', 100_000, 'b2'),
      call('illustration', 400_000, 'b2'),
      call('character', 1_200_000, 'b3'),
      // Libro final del pedido o1: USD 2,00.
      call('story', 500_000, 'b1', 'o1'),
      call('illustration', 1_500_000, 'b1', 'o1'),
    ];
    const report = aiCostReport(records);
    expect(report.perPreview).toEqual([
      {
        imageModel: 'vertex/gemini-3.1-flash-image',
        count: 3,
        avgUsd: 0.67,
        p50Usd: 0.5,
        p95Usd: 1.2,
      },
    ]);
    expect(report.perBook).toEqual([
      { imageModel: 'vertex/gemini-3.1-flash-image', count: 1, avgUsd: 2, p50Usd: 2, p95Usd: 2 },
    ]);
    expect(report.byModel[0]).toEqual({
      provider: 'vertex',
      model: 'gemini-3.1-flash-image',
      calls: 4,
      totalUsd: 3.3,
    });
  });

  it('sin llamadas, todo en cero', () => {
    expect(aiCostReport([])).toEqual({ byModel: [], perPreview: [], perBook: [] });
  });
});
