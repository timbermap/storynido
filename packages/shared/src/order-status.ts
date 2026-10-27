import { z } from 'zod';

export const ORDER_STATUSES = [
  'draft',
  'preview_ready',
  'pending_payment',
  'paid',
  'generating',
  'qa_failed',
  'ready',
  'sent_to_print',
  'in_production',
  'shipped',
  'delivered',
  'refunded',
  'cancelled',
] as const;

export const orderStatusSchema = z.enum(ORDER_STATUSES);

export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const TERMINAL_ORDER_STATUSES = [
  'delivered',
  'refunded',
  'cancelled',
] as const satisfies readonly OrderStatus[];

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return (TERMINAL_ORDER_STATUSES as readonly OrderStatus[]).includes(status);
}

/**
 * Transiciones válidas del pedido. Todo cambio de estado pasa por aquí: el pipeline, los
 * webhooks de pagos e imprenta y el admin.
 */
export const ORDER_TRANSITIONS = {
  draft: ['preview_ready', 'pending_payment', 'cancelled'],
  preview_ready: ['draft', 'pending_payment', 'cancelled'],
  pending_payment: ['paid', 'cancelled'],
  paid: ['generating', 'refunded'],
  generating: ['ready', 'qa_failed', 'refunded'],
  // Revisión manual: el admin reintenta un paso o regenera el libro.
  qa_failed: ['generating', 'refunded', 'cancelled'],
  // Digital: se entrega; impreso: va a la imprenta. El admin puede regenerar antes de enviar.
  ready: ['delivered', 'sent_to_print', 'generating', 'refunded'],
  sent_to_print: ['in_production', 'qa_failed', 'cancelled', 'refunded'],
  in_production: ['shipped', 'refunded'],
  shipped: ['delivered', 'refunded'],
  // Garantía de reimpresión o reembolso después de entregado.
  delivered: ['refunded'],
  refunded: [],
  cancelled: [],
} as const satisfies Record<OrderStatus, readonly OrderStatus[]>;

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return (ORDER_TRANSITIONS[from] as readonly OrderStatus[]).includes(to);
}

export class InvalidOrderTransitionError extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly to: OrderStatus,
  ) {
    super(`Transición de pedido inválida: ${from} → ${to}`);
    this.name = 'InvalidOrderTransitionError';
  }
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) throw new InvalidOrderTransitionError(from, to);
}
