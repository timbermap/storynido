import type { OrderStatus } from '@storynido/shared';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  draft: 'Borrador',
  preview_ready: 'Muestra lista',
  pending_payment: 'Pago pendiente',
  paid: 'Pagado',
  generating: 'Generando',
  qa_failed: 'En revisión',
  ready: 'Listo',
  sent_to_print: 'En imprenta',
  in_production: 'Produciendo',
  shipped: 'Enviado',
  delivered: 'Entregado',
  refunded: 'Reembolsado',
  cancelled: 'Cancelado',
};

/** Estado con texto (nunca solo color); "En revisión" se destaca. */
export function StatusBadge({ status }: { status: OrderStatus }) {
  const attention = status === 'qa_failed';
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${attention ? 'border-destructive/50 font-semibold text-destructive' : ''}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
