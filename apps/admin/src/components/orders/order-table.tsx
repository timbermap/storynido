import type { AdminOrderSummary } from '@storynido/shared';
import Link from 'next/link';
import { useState } from 'react';

import { StatusBadge } from '@/components/ui/status';
import { money } from '@/lib/format';

/** Tabla de pedidos (sin datos del niño): número, cliente, estado, canal, formato y total. */
export function OrderTable({
  orders,
  extra,
  showAge = false,
}: {
  orders: readonly AdminOrderSummary[];
  /** Cuánto lleva esperando cada pedido (en rojo desde los 2 días): para las colas de trabajo. */
  showAge?: boolean;
  extra?: { label: string; render: (order: AdminOrderSummary) => React.ReactNode };
}) {
  if (orders.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay pedidos con esos filtros.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Pedido</th>
            <th className="px-3 py-2">Fecha</th>
            {showAge && <th className="px-3 py-2">Espera</th>}
            <th className="px-3 py-2">Cliente</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2">Canal · país</th>
            <th className="px-3 py-2">Formato</th>
            <th className="px-3 py-2 text-right">Total</th>
            {extra && <th className="px-3 py-2">{extra.label}</th>}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <Link
                  href={`/order?id=${order.id}`}
                  className="font-mono text-xs text-primary underline"
                >
                  {order.id}
                </Link>
              </td>
              <td className="px-3 py-2 text-xs">
                {order.createdAt ? new Date(order.createdAt).toLocaleString('es') : '—'}
              </td>
              {showAge && (
                <td className="px-3 py-2 text-xs font-semibold">
                  <Age since={order.createdAt} />
                </td>
              )}
              <td className="px-3 py-2">{order.customerEmail ?? '—'}</td>
              <td className="px-3 py-2">
                <StatusBadge status={order.status} />
              </td>
              <td className="px-3 py-2">
                {order.channel} · {order.country}
              </td>
              <td className="px-3 py-2">{order.formats.join(', ')}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {money(order.totalMinor, order.currency)}
              </td>
              {extra && <td className="px-3 py-2">{extra.render(order)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Age({ since }: { since: string | null }) {
  const [now] = useState(() => Date.now());
  if (!since) return <>—</>;
  const hours = Math.max(0, Math.floor((now - new Date(since).getTime()) / 3_600_000));
  const label = hours < 48 ? `${String(hours)} h` : `${String(Math.floor(hours / 24))} días`;
  return <span className={hours >= 48 ? 'text-destructive' : undefined}>{label}</span>;
}
