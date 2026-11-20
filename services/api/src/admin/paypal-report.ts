import type {
  AdminPaypal,
  OrderStatus,
  ProviderDispute,
  ProviderTransaction,
} from '@storynido/shared';

/** Cobro de PayPal tal como lo guarda el pedido. */
export interface PaypalOrder {
  orderId: string;
  status: OrderStatus;
  paidAt: Date | null;
  totalMinor: number;
  feeMinor: number | null;
  netMinor: number | null;
  paymentId: string | null;
}

type Row = AdminPaypal['ours']['rows'][number];

/** PayPal tarda hasta ~3 horas en mostrar un movimiento nuevo en la búsqueda de transacciones. */
export const REPORT_DELAY_MS = 3 * 3600 * 1000;

/** Estados de un pedido que nunca llegó a cobrarse: no se concilian. */
const UNPAID: readonly OrderStatus[] = ['pending_payment', 'cancelled'];

/**
 * Cruza los pedidos cobrados con los movimientos de PayPal por el ID de la captura. Solo mira
 * cobros (`kind: payment`); los reembolsos y retiros se muestran aparte.
 */
export function buildPaypalReport(input: {
  orders: readonly PaypalOrder[];
  transactions: readonly ProviderTransaction[] | null;
  from: Date;
  to: Date;
}): Pick<AdminPaypal, 'ours' | 'reconciliation'> {
  const { transactions } = input;
  const payments = new Map(
    (transactions ?? [])
      .filter((tx) => tx.kind === 'payment' && tx.grossMinor > 0)
      .map((tx) => [tx.id, tx] as const),
  );
  const paid = input.orders.filter(
    (order) =>
      !UNPAID.includes(order.status) &&
      order.paidAt !== null &&
      order.paidAt >= input.from &&
      order.paidAt <= input.to,
  );
  const settledBefore = input.to.getTime() - REPORT_DELAY_MS;
  const rows: Row[] = paid.map((order) => {
    let match: Row['match'] = 'sin_datos';
    if (transactions) {
      const tx = order.paymentId ? payments.get(order.paymentId) : undefined;
      if (tx) match = tx.grossMinor === order.totalMinor ? 'ok' : 'monto';
      // Un cobro de hace minutos todavía puede no figurar en PayPal: no se marca como falta.
      else match = (order.paidAt?.getTime() ?? 0) > settledBefore ? 'sin_datos' : 'falta';
    }
    return {
      orderId: order.orderId,
      status: order.status,
      paidAt: order.paidAt?.toISOString() ?? null,
      totalMinor: order.totalMinor,
      feeMinor: order.feeMinor,
      netMinor: order.netMinor,
      paymentId: order.paymentId,
      match,
    };
  });
  rows.sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''));

  const withFee = rows.filter((row) => row.feeMinor !== null);
  const refunded = paid.filter((order) => order.status === 'refunded');
  const ours: AdminPaypal['ours'] = {
    rows,
    grossMinor: sum(rows.map((row) => row.totalMinor)),
    feeMinor: sum(withFee.map((row) => row.feeMinor ?? 0)),
    feeKnown: withFee.length,
    netMinor: sum(withFee.map((row) => row.netMinor ?? row.totalMinor - (row.feeMinor ?? 0))),
    refundedMinor: sum(refunded.map((order) => order.totalMinor)),
    refundedCount: refunded.length,
  };
  if (!transactions) return { ours, reconciliation: null };

  const known = new Set(paid.map((order) => order.paymentId).filter(Boolean));
  const paypalOnly = [...payments.values()]
    .filter((tx) => !known.has(tx.id))
    .map((tx) => ({
      id: tx.id,
      orderId: tx.orderId,
      grossMinor: tx.grossMinor,
      at: tx.at.toISOString(),
    }));
  return {
    ours,
    reconciliation: { matched: rows.filter((row) => row.match === 'ok').length, paypalOnly },
  };
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/** Une las consultas por tramos (PayPal limita cada una a 31 días) sin repetir movimientos. */
export function mergeTransactions(
  chunks: readonly (readonly ProviderTransaction[])[],
): ProviderTransaction[] {
  const byId = new Map<string, ProviderTransaction>();
  for (const chunk of chunks) for (const tx of chunk) byId.set(`${tx.id}:${tx.code}`, tx);
  return [...byId.values()].sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** Tramos de hasta 30 días, del más viejo al más nuevo. */
export function dateChunks(from: Date, to: Date, maxDays = 30): [Date, Date][] {
  const step = maxDays * 24 * 3600 * 1000;
  const out: [Date, Date][] = [];
  for (let start = from.getTime(); start < to.getTime(); start += step) {
    out.push([new Date(start), new Date(Math.min(start + step, to.getTime()))]);
  }
  return out;
}

/** Texto en castellano para un error de lectura de PayPal (la causa más común: falta el permiso). */
export function paypalReadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // PayPal explica la causa en el cuerpo de la respuesta: se muestra para no adivinar.
  const detail = message.slice(0, 300);
  if (/NOT_AUTHORIZED|HTTP 403|HTTP 401/.test(message)) {
    return `PayPal no deja leer esto con las credenciales actuales. En developer.paypal.com → Apps & Credentials → tu app → Features, activá «Transaction Search» (y «Disputes» para las disputas); los cambios tardan unos minutos. Detalle de PayPal: ${detail}`;
  }
  if (message.includes('HTTP 429')) {
    return 'PayPal pidió esperar un momento. Probá de nuevo en un minuto.';
  }
  return detail;
}

export const withOrderOnDispute = (
  disputes: readonly ProviderDispute[],
  orderByPayment: ReadonlyMap<string, string>,
) =>
  disputes.map((dispute) => ({
    id: dispute.id,
    status: dispute.status,
    reason: dispute.reason,
    currency: dispute.currency,
    amountMinor: dispute.amountMinor,
    createdAt: dispute.createdAt?.toISOString() ?? null,
    updatedAt: dispute.updatedAt?.toISOString() ?? null,
    paymentId: dispute.paymentId,
    orderId: dispute.paymentId ? (orderByPayment.get(dispute.paymentId) ?? null) : null,
  }));
