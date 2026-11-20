import type { ProviderTransaction } from '@storynido/shared';
import { describe, expect, it } from 'vitest';

import {
  buildPaypalReport,
  dateChunks,
  mergeTransactions,
  paypalReadError,
  type PaypalOrder,
} from './paypal-report';

const TO = new Date('2026-11-20T12:00:00Z');
const FROM = new Date('2026-11-01T00:00:00Z');

const order = (id: string, over: Partial<PaypalOrder> = {}): PaypalOrder => ({
  orderId: id,
  status: 'paid',
  paidAt: new Date('2026-11-10T10:00:00Z'),
  totalMinor: 1599,
  feeMinor: 116,
  netMinor: 1483,
  paymentId: `CAP-${id}`,
  ...over,
});

const tx = (id: string, over: Partial<ProviderTransaction> = {}): ProviderTransaction => ({
  id,
  kind: 'payment',
  code: 'T0006',
  status: 'S',
  at: new Date('2026-11-10T10:00:00Z'),
  currency: 'USD',
  grossMinor: 1599,
  feeMinor: -116,
  orderId: null,
  relatedId: null,
  ...over,
});

describe('conciliación de PayPal', () => {
  it('suma bruto, comisión y neto, y cruza por el ID de la captura', () => {
    const report = buildPaypalReport({
      orders: [order('a'), order('b')],
      transactions: [tx('CAP-a'), tx('CAP-b')],
      from: FROM,
      to: TO,
    });
    expect(report.ours).toMatchObject({
      grossMinor: 3198,
      feeMinor: 232,
      feeKnown: 2,
      netMinor: 2966,
    });
    expect(report.reconciliation).toEqual({ matched: 2, paypalOnly: [] });
  });

  it('un cobro viejo que PayPal no muestra es «falta»; uno de hace minutos no', () => {
    const report = buildPaypalReport({
      orders: [order('viejo'), order('nuevo', { paidAt: new Date('2026-11-20T11:30:00Z') })],
      transactions: [],
      from: FROM,
      to: TO,
    });
    const byId = Object.fromEntries(report.ours.rows.map((row) => [row.orderId, row.match]));
    expect(byId).toEqual({ viejo: 'falta', nuevo: 'sin_datos' });
  });

  it('otro importe en PayPal se marca «monto»', () => {
    const report = buildPaypalReport({
      orders: [order('a')],
      transactions: [tx('CAP-a', { grossMinor: 1499 })],
      from: FROM,
      to: TO,
    });
    expect(report.ours.rows[0]?.match).toBe('monto');
  });

  it('cobros de PayPal sin pedido nuestro aparecen aparte (webhook perdido)', () => {
    const report = buildPaypalReport({
      orders: [order('a')],
      transactions: [tx('CAP-a'), tx('CAP-x', { orderId: 'ord_x' })],
      from: FROM,
      to: TO,
    });
    expect(report.reconciliation?.paypalOnly).toEqual([
      { id: 'CAP-x', orderId: 'ord_x', grossMinor: 1599, at: '2026-11-10T10:00:00.000Z' },
    ]);
  });

  it('pedidos sin cobrar o fuera del período no cuentan; reembolsos se suman aparte', () => {
    const report = buildPaypalReport({
      orders: [
        order('p', { status: 'pending_payment', paidAt: null }),
        order('fuera', { paidAt: new Date('2026-10-01T00:00:00Z') }),
        order('r', { status: 'refunded' }),
      ],
      transactions: null,
      from: FROM,
      to: TO,
    });
    expect(report.ours.rows.map((row) => row.orderId)).toEqual(['r']);
    expect(report.ours).toMatchObject({ refundedMinor: 1599, refundedCount: 1 });
    expect(report.reconciliation).toBeNull();
    expect(report.ours.rows[0]?.match).toBe('sin_datos');
  });

  it('pedidos anteriores sin comisión guardada no entran en el neto', () => {
    const report = buildPaypalReport({
      orders: [order('a', { feeMinor: null, netMinor: null })],
      transactions: null,
      from: FROM,
      to: TO,
    });
    expect(report.ours).toMatchObject({ grossMinor: 1599, feeMinor: 0, feeKnown: 0, netMinor: 0 });
  });
});

describe('ayudas de lectura', () => {
  it('parte el período en tramos de 30 días', () => {
    const chunks = dateChunks(new Date('2026-08-23T00:00:00Z'), TO);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]?.[0]).toEqual(new Date('2026-08-23T00:00:00Z'));
    expect(chunks.at(-1)?.[1]).toEqual(TO);
  });

  it('une tramos sin repetir y ordena del más nuevo al más viejo', () => {
    const merged = mergeTransactions([
      [tx('a', { at: new Date('2026-11-01T00:00:00Z') })],
      [tx('a', { at: new Date('2026-11-01T00:00:00Z') }), tx('b')],
    ]);
    expect(merged.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('el 403 se explica con el permiso que falta', () => {
    expect(paypalReadError(new Error('PayPal no pudo leer (HTTP 403): NOT_AUTHORIZED'))).toContain(
      'Transaction Search',
    );
  });
});
