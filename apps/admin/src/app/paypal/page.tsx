'use client';

import type { AdminPaypal } from '@storynido/shared';
import Link from 'next/link';
import { useCallback, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, Notice, PageHeader } from '@/components/ui/page-header';
import { STATUS_LABEL } from '@/components/ui/status';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';

const PERIODS = [7, 30, 90] as const;

const usd = (minor: number) =>
  (minor / 100).toLocaleString('es', { style: 'currency', currency: 'USD' });
const money = (minor: number, currency: string) =>
  (minor / 100).toLocaleString('es', { style: 'currency', currency });
const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('es', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Argentina/Buenos_Aires',
      })
    : '—';

const MATCH_LABEL = {
  ok: '✓ Coincide con PayPal',
  falta: '✕ No aparece en PayPal',
  monto: '✕ Otro importe en PayPal',
  sin_datos: '· Sin comparar',
} as const;

const KIND_LABEL = {
  payment: 'Cobro',
  refund: 'Reembolso',
  withdrawal: 'Retiro',
  dispute: 'Disputa',
  other: 'Otro movimiento',
} as const;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-accent/50 text-xs text-muted-foreground">
          <tr>
            {head.map((label) => (
              <th key={label} className="px-3 py-2 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

const cell = 'px-3 py-2 tabular-nums';

/**
 * Cobros de PayPal: lo que entró, la comisión real, lo que queda, el saldo de la billetera, los
 * reembolsos, las disputas y la conciliación contra nuestros pedidos. Solo lectura: los
 * reembolsos se hacen desde el detalle del pedido (con confirmación) y los retiros, en PayPal.
 */
export default function PaypalPage() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const load = useCallback(() => api('adminPaypal', { query: { days } }), [days]);
  const { data, error, reload } = useApi(load);
  const [reloading, setReloading] = useState(false);

  async function refresh() {
    setReloading(true);
    try {
      await reload();
    } finally {
      setReloading(false);
    }
  }

  const actions = (
    <div className="flex items-center gap-2">
      <select
        aria-label="Período"
        className="h-9 rounded-md border bg-background px-2 text-sm"
        value={days}
        onChange={(event) => {
          setDays(Number(event.target.value) as (typeof PERIODS)[number]);
        }}
      >
        {PERIODS.map((value) => (
          <option key={value} value={value}>
            Últimos {value} días
          </option>
        ))}
      </select>
      <Button variant="outline" size="sm" disabled={reloading} onClick={() => void refresh()}>
        {reloading ? 'Actualizando…' : 'Actualizar'}
      </Button>
    </div>
  );

  if (error)
    return (
      <>
        <PageHeader title="Cobros PayPal" actions={actions} />
        <Notice tone="error">{error}</Notice>
      </>
    );
  if (!data) return <p role="status">Cargando…</p>;
  return <Report data={data} actions={actions} />;
}

function Report({ data, actions }: { data: AdminPaypal; actions: ReactNode }) {
  const { ours, live, reconciliation } = data;
  const usdBalance = live.balances?.find((balance) => balance.currency === 'USD');
  const openDisputes = (live.disputes ?? []).filter(
    (dispute) => !['RESOLVED', 'CLOSED'].includes(dispute.status.toUpperCase()),
  );
  const refunds = (live.transactions ?? []).filter((tx) => tx.kind === 'refund');
  const withdrawals = (live.transactions ?? []).filter((tx) => tx.kind === 'withdrawal');
  const movements = (live.transactions ?? []).slice(0, 100);
  const withFee = ours.rows.filter((row) => row.feeMinor !== null);
  const feeBase = withFee.reduce((sum, row) => sum + row.totalMinor, 0);
  const feeRate = feeBase > 0 ? (ours.feeMinor / feeBase) * 100 : null;
  const withoutFee = ours.rows.length - ours.feeKnown;
  const problems = ours.rows.filter((row) => row.match === 'falta' || row.match === 'monto');
  const toReview = problems.length + (reconciliation?.paypalOnly.length ?? 0);

  return (
    <>
      <PageHeader
        title="Cobros PayPal"
        text="Solo lectura: lo que cobramos, lo que cobra PayPal, lo que queda en la billetera y si cierra con los pedidos."
        actions={actions}
      />
      {data.environment === null ? (
        <Notice>
          {data.activeProvider === 'paypal'
            ? 'PayPal no está configurado en este entorno.'
            : `El cobro activo en este entorno es «${data.activeProvider}», no PayPal: acá solo aparecen los pedidos que ya se cobraron con PayPal.`}
        </Notice>
      ) : (
        <p className="mb-4 text-sm">
          <span
            className={`mr-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${data.environment === 'live' ? 'border-green-700/40 text-green-800' : ''}`}
          >
            {data.environment === 'live' ? 'En vivo' : 'Pruebas (sandbox)'}
          </span>
          {data.environment === 'sandbox' &&
            'La plata de este entorno no es real: es la billetera de pruebas de PayPal.'}
        </p>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Cobrado"
          value={usd(ours.grossMinor)}
          hint={`${String(ours.rows.length)} pedidos`}
        />
        <Stat
          label="Comisión de PayPal"
          value={usd(ours.feeMinor)}
          hint={
            feeRate === null
              ? 'Todavía sin cobros con comisión guardada'
              : `${feeRate.toFixed(1)} % de lo cobrado (real)`
          }
        />
        <Stat
          label="Neto a la billetera"
          value={usd(ours.netMinor)}
          hint="Cobrado menos comisión"
        />
        <Stat
          label="Reembolsado"
          value={usd(ours.refundedMinor)}
          hint={`${String(ours.refundedCount)} pedidos (la comisión no se devuelve)`}
        />
      </div>
      {withoutFee > 0 && (
        <p className="-mt-3 mb-6 text-xs text-muted-foreground">
          {withoutFee} cobro{withoutFee === 1 ? '' : 's'} anterior{withoutFee === 1 ? '' : 'es'} al
          seguimiento no tiene{withoutFee === 1 ? '' : 'n'} la comisión guardada: no entra
          {withoutFee === 1 ? '' : 'n'} en la comisión ni en el neto.
        </p>
      )}

      <PageHeader
        level={2}
        title="Billetera"
        text="Saldo en PayPal. Retirá en dólares: convertir a pesos dentro de PayPal cuesta 3,5 % extra."
      />
      {live.balancesError ? (
        <Notice tone="error">{live.balancesError}</Notice>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Disponible"
            value={usd(usdBalance?.availableMinor ?? 0)}
            hint="Se puede retirar"
          />
          <Stat
            label="Retenido"
            value={usd(usdBalance?.withheldMinor ?? 0)}
            hint="PayPal lo libera más adelante"
          />
          <Stat label="Total" value={usd(usdBalance?.totalMinor ?? 0)} />
        </div>
      )}

      <PageHeader
        level={2}
        title="Conciliación"
        text="Cada cobro de un pedido, buscado en PayPal por el ID de la captura. PayPal tarda hasta 3 horas en mostrar un movimiento nuevo."
      />
      {live.transactionsError ? (
        <Notice tone="error">{live.transactionsError}</Notice>
      ) : reconciliation && toReview === 0 ? (
        <Notice>
          ✓ Todo cierra: {reconciliation.matched} cobro{reconciliation.matched === 1 ? '' : 's'}{' '}
          coinciden con PayPal en importe.
        </Notice>
      ) : (
        reconciliation && (
          <Notice tone="error">
            Hay {toReview} cosa{toReview === 1 ? '' : 's'} para revisar (más abajo, marcadas con ✕).
          </Notice>
        )
      )}
      {reconciliation && reconciliation.paypalOnly.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-sm font-medium">
            Cobros en PayPal sin pedido nuestro (¿se perdió un aviso?)
          </p>
          <Table head={['Fecha', 'Captura', 'Pedido que informa', 'Importe']}>
            {reconciliation.paypalOnly.map((tx) => (
              <tr key={tx.id}>
                <td className={cell}>{when(tx.at)}</td>
                <td className={cell}>{tx.id}</td>
                <td className={cell}>{tx.orderId ?? '—'}</td>
                <td className={cell}>{usd(tx.grossMinor)}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      <PageHeader level={2} title="Cobros por pedido" />
      {ours.rows.length === 0 ? (
        <Notice>No hay cobros con PayPal en este período.</Notice>
      ) : (
        <Table head={['Pedido', 'Fecha', 'Estado', 'Cobrado', 'Comisión', 'Neto', 'Contra PayPal']}>
          {ours.rows.map((row) => (
            <tr key={row.orderId}>
              <td className={cell}>
                <Link className="underline" href={`/order?id=${row.orderId}`}>
                  {row.orderId.slice(0, 8)}
                </Link>
              </td>
              <td className={cell}>{when(row.paidAt)}</td>
              <td className={cell}>{STATUS_LABEL[row.status]}</td>
              <td className={cell}>{usd(row.totalMinor)}</td>
              <td className={cell}>{row.feeMinor === null ? '—' : usd(row.feeMinor)}</td>
              <td className={cell}>{row.netMinor === null ? '—' : usd(row.netMinor)}</td>
              <td
                className={`${cell} ${row.match === 'falta' || row.match === 'monto' ? 'font-semibold text-destructive' : ''}`}
              >
                {MATCH_LABEL[row.match]}
              </td>
            </tr>
          ))}
        </Table>
      )}

      <PageHeader
        level={2}
        title={`Disputas${openDisputes.length ? ` (${String(openDisputes.length)} abiertas)` : ''}`}
        text="Respondelas en PayPal antes del plazo. Desde acá no se acepta ni se rechaza nada."
      />
      {live.disputesError ? (
        <Notice tone="error">{live.disputesError}</Notice>
      ) : (live.disputes ?? []).length === 0 ? (
        <Notice>Sin disputas.</Notice>
      ) : (
        <Table head={['Abierta', 'Estado', 'Motivo', 'Importe', 'Pedido']}>
          {(live.disputes ?? []).map((dispute) => (
            <tr key={dispute.id}>
              <td className={cell}>{when(dispute.createdAt)}</td>
              <td className={cell}>{dispute.status}</td>
              <td className={cell}>{dispute.reason.replaceAll('_', ' ').toLowerCase()}</td>
              <td className={cell}>{money(dispute.amountMinor, dispute.currency)}</td>
              <td className={cell}>
                {dispute.orderId ? (
                  <Link className="underline" href={`/order?id=${dispute.orderId}`}>
                    {dispute.orderId.slice(0, 8)}
                  </Link>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      <PageHeader
        level={2}
        title="Reembolsos y retiros"
        text="Los reembolsos se hacen desde el detalle del pedido (piden confirmación y quedan en auditoría)."
      />
      {live.transactions && refunds.length + withdrawals.length === 0 ? (
        <Notice>Sin reembolsos ni retiros en el período.</Notice>
      ) : (
        <Table head={['Fecha', 'Tipo', 'Importe', 'Comisión', 'Pedido']}>
          {[...refunds, ...withdrawals]
            .sort((a, b) => b.at.localeCompare(a.at))
            .map((tx) => (
              <tr key={`${tx.id}-${tx.code}`}>
                <td className={cell}>{when(tx.at)}</td>
                <td className={cell}>{KIND_LABEL[tx.kind]}</td>
                <td className={cell}>{money(tx.grossMinor, tx.currency)}</td>
                <td className={cell}>{money(tx.feeMinor, tx.currency)}</td>
                <td className={cell}>{tx.orderId ?? '—'}</td>
              </tr>
            ))}
        </Table>
      )}

      <PageHeader
        level={2}
        title="Todos los movimientos"
        text="Los últimos 100 de la billetera, como los informa PayPal."
      />
      {movements.length === 0 ? (
        <Notice>{live.transactionsError ? 'No se pudieron leer.' : 'Sin movimientos.'}</Notice>
      ) : (
        <Table head={['Fecha', 'Tipo', 'Importe', 'Comisión', 'Estado', 'Pedido']}>
          {movements.map((tx) => (
            <tr key={`${tx.id}-${tx.code}`}>
              <td className={cell}>{when(tx.at)}</td>
              <td className={cell}>{KIND_LABEL[tx.kind]}</td>
              <td className={cell}>{money(tx.grossMinor, tx.currency)}</td>
              <td className={cell}>{money(tx.feeMinor, tx.currency)}</td>
              <td className={cell}>{tx.status}</td>
              <td className={cell}>{tx.orderId ?? '—'}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
