import { describe, expect, it } from 'vitest';

import { aggregateDay, sumMetrics, toUsd, type MetricsOrder } from './metrics';

const fx = { rates: { MXN: 20, USD: 1 }, source: 'open.er-api.com', date: '2026-10-27' };

const order = (overrides: Partial<MetricsOrder> = {}): MetricsOrder => ({
  status: 'paid',
  channel: 'families',
  country: 'MX',
  currency: 'MXN',
  amounts: { totalMinor: 40000, taxMinor: 5517 },
  printCostUsdMinor: null,
  ...overrides,
});

describe('métricas del dashboard', () => {
  it('convierte a USD con la cotización del día (y la unidad mínima de cada moneda)', () => {
    expect(toUsd(40000, 'MXN', fx)).toBe(20);
    expect(toUsd(1999, 'USD', fx)).toBe(19.99);
    expect(toUsd(1000, 'EUR', fx)).toBe(0);
  });

  it('ventas, ticket, conversión, costos y margen; reembolsos y pendientes no son venta', () => {
    const day = aggregateDay({
      day: '2026-10-27',
      final: true,
      previews: 8,
      aiCostUsdMicros: 3_500_000,
      fx,
      orders: [
        order(),
        order({
          country: 'US',
          currency: 'USD',
          channel: 'professionals',
          amounts: { totalMinor: 3999, taxMinor: 0 },
          printCostUsdMinor: 1152,
        }),
        order({ status: 'refunded' }),
        order({ status: 'pending_payment' }),
      ],
    });
    expect(day).toMatchObject({
      orders: 2,
      refunds: 1,
      revenueUsd: 59.99,
      netRevenueUsd: 57.23,
      revenueByCurrency: { MXN: 40000, USD: 3999 },
      revenueUsdByCountry: { MX: 20, US: 39.99 },
      ordersByChannel: { families: 1, professionals: 1 },
      avgTicketUsd: 30,
      conversionPct: 25,
      aiCostUsd: 3.5,
      printCostUsd: 11.52,
      marginUsd: 42.21,
    });
    const total = sumMetrics([day, { ...day, day: '2026-10-28' }]);
    expect(total).toMatchObject({
      orders: 4,
      revenueUsd: 119.98,
      conversionPct: 25,
      avgTicketUsd: 30,
    });
  });
});
