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
