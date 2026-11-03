import type { OrderStatus } from '@storynido/shared';

/** El pedido lleva algo impreso (libro o tarjetas): pasa por la imprenta y el envío. */
export const isPrintOrder = (items: readonly { format: string }[]) =>
  items.some((item) => item.format !== 'digital');

interface OrderLike {
  status: OrderStatus;
  items: readonly { format: string }[];
}

/** Un pedido "en curso": pagado y todavía sin llegar (un digital listo ya está terminado). */
export function isOrderInProgress(order: OrderLike): boolean {
  const unpaidOrClosed = [
    'draft',
    'preview_ready',
    'pending_payment',
    'cancelled',
    'refunded',
    'delivered',
  ];
  if (unpaidOrClosed.includes(order.status)) {
    return false;
  }
  return !(order.status === 'ready' && !isPrintOrder(order.items));
}

/** Un pedido "terminado": entregado, o digital y listo. */
export function isOrderDone(order: OrderLike): boolean {
  return order.status === 'delivered' || (order.status === 'ready' && !isPrintOrder(order.items));
}
