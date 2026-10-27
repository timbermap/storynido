import { describe, expect, it } from 'vitest';

import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  assertOrderTransition,
  canTransitionOrder,
  isTerminalOrderStatus,
  orderStatusSchema,
  type OrderStatus,
} from './order-status';

describe('order status', () => {
  it('incluye los 13 estados del pedido', () => {
    expect(ORDER_STATUSES).toHaveLength(13);
  });

  it('rechaza estados desconocidos', () => {
    expect(orderStatusSchema.safeParse('paid').success).toBe(true);
    expect(orderStatusSchema.safeParse('lost').success).toBe(false);
  });

  it('identifica estados terminales', () => {
    expect(isTerminalOrderStatus('delivered')).toBe(true);
    expect(isTerminalOrderStatus('generating')).toBe(false);
  });

  it('el camino feliz digital e impreso es válido', () => {
    const digital: OrderStatus[] = [
      'draft',
      'pending_payment',
      'paid',
      'generating',
      'ready',
      'delivered',
    ];
    const print: OrderStatus[] = [
      'paid',
      'generating',
      'ready',
      'sent_to_print',
      'in_production',
      'shipped',
      'delivered',
    ];
    for (const path of [digital, print]) {
      const pairs = path.slice(1).map((to, index) => [path[index], to] as const);
      for (const [from, to] of pairs) {
        expect(from && canTransitionOrder(from, to)).toBe(true);
      }
    }
  });

  it('una falla de calidad vuelve a generar o termina en reembolso', () => {
    expect(canTransitionOrder('generating', 'qa_failed')).toBe(true);
    expect(canTransitionOrder('qa_failed', 'generating')).toBe(true);
    expect(canTransitionOrder('qa_failed', 'refunded')).toBe(true);
  });

  it('rechaza saltos inválidos', () => {
    expect(canTransitionOrder('pending_payment', 'generating')).toBe(false);
    expect(canTransitionOrder('draft', 'paid')).toBe(false);
    expect(canTransitionOrder('shipped', 'generating')).toBe(false);
    expect(() => {
      assertOrderTransition('paid', 'shipped');
    }).toThrow('paid → shipped');
  });

  it('los estados finales no salen a ningún lado y todo estado tiene sus transiciones', () => {
    expect(ORDER_TRANSITIONS.refunded).toEqual([]);
    expect(ORDER_TRANSITIONS.cancelled).toEqual([]);
    expect(Object.keys(ORDER_TRANSITIONS).sort()).toEqual([...ORDER_STATUSES].sort());
  });
});
