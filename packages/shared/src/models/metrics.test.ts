import { describe, expect, it } from 'vitest';

import {
  aggregateDay,
  estimatePaymentFeeUsd,
  metricsProductKey,
  sumMetrics,
  toUsd,
  type MetricsOrder,
} from './metrics';

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
      taxUsd: 2.76,
    });
    const total = sumMetrics([day, { ...day, day: '2026-10-28' }]);
    expect(total).toMatchObject({
      orders: 4,
      revenueUsd: 119.98,
      conversionPct: 25,
      avgTicketUsd: 30,
    });
  });

  it('embudo del día: libros creados, etapas de la muestra, pagos iniciados y compras', () => {
    const day = aggregateDay({
      day: '2026-10-29',
      final: false,
      previews: 2,
      aiCostUsdMicros: 0,
      fx,
      orders: [order(), order({ status: 'pending_payment' })],
      books: [
        { character: true, approved: true, preview: true },
        { character: true, approved: false, preview: false },
        { character: false, approved: false, preview: false },
      ],
    });
    expect(day.funnel).toEqual({
      started: 3,
      character: 2,
      approved: 1,
      preview: 1,
      checkout: 2,
      purchased: 1,
    });
    // Sin libros (días anteriores) no hay embudo, y el total lo cuenta aparte.
    const old = aggregateDay({ ...day, orders: [], aiCostUsdMicros: 0, fx, previews: 0 });
    expect(old.funnel).toBeUndefined();
    expect(sumMetrics([day, old])).toMatchObject({ funnel: { started: 3 }, daysWithoutFunnel: 1 });
  });

  it('comisión estimada por proveedor; mock y desconocidos usan la de Dodo', () => {
    expect(estimatePaymentFeeUsd(21.99, 'dodo')).toBeCloseTo(1.61, 2);
    expect(estimatePaymentFeeUsd(21.99, 'gumroad')).toBeCloseTo(3.64, 2);
    expect(estimatePaymentFeeUsd(21.99, 'mock')).toBeCloseTo(1.61, 2);
    expect(estimatePaymentFeeUsd(0, 'dodo')).toBe(0);
  });

  it('contribución: resta impuestos, comisión (también de reembolsos), toda la IA e impresión', () => {
    const day = aggregateDay({
      day: '2026-11-17',
      final: true,
      previews: 4,
      aiCostUsdMicros: 6_000_000,
      aiOrdersUsdMicros: 3_900_000,
      fx,
      orders: [
        order({
          country: 'US',
          currency: 'USD',
          amounts: { totalMinor: 2199, taxMinor: 0 },
          paymentProvider: 'dodo',
          product: 'classic_digital',
          aiCostUsdMicros: 3_900_000,
        }),
        order({
          status: 'refunded',
          country: 'US',
          currency: 'USD',
          amounts: { totalMinor: 1399, taxMinor: 0 },
          paymentProvider: 'dodo',
        }),
      ],
    });
    // Comisión: 1,61 del cobro + 1,17 del reembolsado (no se devuelve).
    expect(day).toMatchObject({
      revenueUsd: 21.99,
      paymentFeeUsd: 2.78,
      aiBooksUsd: 3.9,
      aiPreviewsUsd: 2.1,
      refundedUsd: 13.99,
      contributionUsd: 13.21,
      products: {
        classic_digital: {
          units: 1,
          revenueUsd: 21.99,
          taxUsd: 0,
          feeUsd: 1.61,
          aiUsd: 3.9,
          printUsd: 0,
        },
      },
    });
    const total = sumMetrics([day, { ...day, day: '2026-11-18' }]);
    expect(total.contributionUsd).toBe(26.42);
    expect(total.products.classic_digital?.units).toBe(2);
  });

  it('embudo por línea', () => {
    const day = aggregateDay({
      day: '2026-11-17',
      final: false,
      previews: 0,
      aiCostUsdMicros: 0,
      fx,
      orders: [
        order({ channel: 'events' }),
        order({ channel: 'events', status: 'pending_payment' }),
      ],
      books: [
        { character: true, approved: true, preview: true, channel: 'events' },
        { character: true, approved: false, preview: false },
      ],
    });
    expect(day.funnelByChannel?.events).toMatchObject({ started: 1, checkout: 2, purchased: 1 });
    expect(day.funnelByChannel?.families).toMatchObject({ started: 1, purchased: 0 });
    const total = sumMetrics([day, day]);
    expect(total.funnelByChannel.events?.started).toBe(2);
  });

  it('producto: kit, invitación, piezas y libros por extensión, contenido, formato y línea', () => {
    const base = {
      format: 'digital',
      components: [],
      discountReason: null,
      length: 'classic',
      contentType: 'story',
    };
    expect(metricsProductKey({ ...base, channel: 'families' })).toBe('classic_digital');
    expect(
      metricsProductKey({
        ...base,
        channel: 'professionals',
        length: 'mini',
        contentType: 'story_activities',
      }),
    ).toBe('pro_story_activities_mini_digital');
    expect(
      metricsProductKey({ ...base, channel: 'families', length: null, format: 'hardcover' }),
    ).toBe('classic_hardcover');
    const kit = { ...base, channel: 'events' };
    expect(metricsProductKey({ ...kit, components: ['design'] })).toBe('event_invitation');
    expect(
      metricsProductKey({ ...kit, components: ['design', 'piece'], discountReason: 'bundle' }),
    ).toBe('event_kit');
    expect(metricsProductKey({ ...kit, components: ['design', 'piece'] })).toBe(
      'event_kit_partial',
    );
    expect(metricsProductKey({ ...kit, components: ['piece'] })).toBe('event_extra');
    expect(metricsProductKey({ ...kit, components: ['cards'] })).toBe('event_cards');
  });
});
