import { describe, expect, it } from 'vitest';

import { AnalyticsService, type GaReportResponse, type RunReport } from './service';

const rows = (data: [string[], string[]][]): GaReportResponse => ({
  rows: data.map(([dimensions, metrics]) => ({
    dimensionValues: dimensions.map((value) => ({ value })),
    metricValues: metrics.map((value) => ({ value })),
  })),
});

const fake = (): { run: RunReport; calls: Record<string, unknown>[] } => {
  const calls: Record<string, unknown>[] = [];
  const run: RunReport = (request) => {
    calls.push(request);
    const dimension = (request.dimensions as { name: string }[] | undefined)?.[0]?.name;
    if (!dimension) return Promise.resolve(rows([[[], ['10', '14', '40', '2', '45.98']]]));
    if (dimension === 'date') return Promise.resolve(rows([[['20261122'], ['6', '8']]]));
    if (dimension === 'sessionSourceMedium') {
      return Promise.resolve(rows([[['instagram / social'], ['4', '5', '1']]]));
    }
    if (dimension === 'country') return Promise.resolve(rows([[['Mexico'], ['7']]]));
    if (dimension === 'pagePath') return Promise.resolve(rows([[['/es'], ['30']]]));
    return Promise.resolve(rows([[['purchase'], ['2']]]));
  };
  return { run, calls };
};

describe('AnalyticsService', () => {
  it('sin propiedad configurada avisa qué falta y no consulta nada', async () => {
    const report = await new AnalyticsService(null).report(30);
    expect(report.connected).toBe(false);
    expect(report.message).toContain('GA4_PROPERTY_ID');
  });

  it('arma el reporte con totales, días, fuentes, países, páginas y pasos del embudo', async () => {
    const { run } = fake();
    const report = await new AnalyticsService(run).report(30);
    expect(report.connected).toBe(true);
    expect(report.totals).toEqual({
      users: 10,
      sessions: 14,
      views: 40,
      purchases: 2,
      revenue: 45.98,
    });
    expect(report.daily).toEqual([{ day: '2026-11-22', users: 6, sessions: 8 }]);
    expect(report.sources[0]).toEqual({
      key: 'instagram / social',
      users: 4,
      sessions: 5,
      purchases: 1,
    });
    expect(report.countries).toEqual([{ key: 'Mexico', users: 7 }]);
    expect(report.pages).toEqual([{ key: '/es', views: 30 }]);
    expect(report.events.find((row) => row.key === 'purchase')?.count).toBe(2);
    expect(report.events.find((row) => row.key === 'create_started')?.count).toBe(0);
  });

  it('repite la respuesta dentro de los 10 minutos y vuelve a consultar después', async () => {
    const { run, calls } = fake();
    let now = 0;
    const service = new AnalyticsService(run, () => now);
    await service.report(7);
    const first = calls.length;
    now = 5 * 60 * 1000;
    await service.report(7);
    expect(calls.length).toBe(first);
    now = 11 * 60 * 1000;
    await service.report(7);
    expect(calls.length).toBe(first * 2);
  });

  it('si Google rechaza la lectura (403) explica cómo darle acceso y no lanza', async () => {
    const run: RunReport = () =>
      Promise.reject(Object.assign(new Error('x'), { response: { status: 403 } }));
    const report = await new AnalyticsService(run).report(30);
    expect(report.connected).toBe(false);
    expect(report.message).toContain('Lector');
  });
});
