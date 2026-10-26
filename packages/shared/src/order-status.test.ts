import { describe, expect, it } from 'vitest';

import { ORDER_STATUSES, isTerminalOrderStatus, orderStatusSchema } from './order-status';

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
});
