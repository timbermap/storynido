'use client';

import { PIPELINE_STEPS, type PipelineStep } from '@storynido/shared';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, Notice, PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { errorMessage, useApi } from '@/lib/use-api';

const usd = (value: number) => `USD ${value.toFixed(2)}`;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Detalle del pedido: montos, costos y margen, imprenta, pipeline, QA y acciones. */
function OrderDetail({ id }: { id: string }) {
  const load = useCallback(
    () =>
      Promise.all([
        api('adminOrderDetail', { params: { orderId: id } }),
        api('adminOrderPipeline', { params: { orderId: id } }),
      ]),
    [id],
  );
  const { data, error, reload } = useApi(load);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [fromStep, setFromStep] = useState<PipelineStep | ''>('');
  const [showPages, setShowPages] = useState(false);

  async function act(question: string, run: () => Promise<string>) {
    if (!window.confirm(question)) return;
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ text: await run(), error: false });
      await reload();
    } catch (caught) {
      setMessage({ text: errorMessage(caught), error: true });
    } finally {
      setBusy(false);
    }
  }

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <p role="status">Cargando…</p>;
  const [order, pipeline] = data;
  const params = { orderId: id };
  const printing = order.print !== null;

  return (
    <>
      <PageHeader
        title={`Pedido ${order.id}`}
        text={`${order.customerEmail ?? 'sin email'} · ${order.channel} · ${order.country}`}
        actions={<StatusBadge status={order.status} />}
      />
      {message && (
        <div className="mb-4">
          <Notice tone={message.error ? 'error' : 'info'}>{message.text}</Notice>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold">Montos</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm tabular-nums">
            <Row label="Subtotal">{money(order.amounts.subtotalMinor, order.currency)}</Row>
            <Row label="Descuento">
              {money(order.amounts.discountMinor, order.currency)}
              {order.discount.label ? ` (${order.discount.label})` : ''}
            </Row>
            <Row label="Envío">{money(order.amounts.shippingMinor, order.currency)}</Row>
            <Row label="Impuestos">{money(order.amounts.taxMinor, order.currency)}</Row>
            <Row label="Total">
              <strong>{money(order.amounts.totalMinor, order.currency)}</strong>
            </Row>
            <Row label="Pago">
              {order.payment.provider} · {order.payment.paymentId ?? '—'}
            </Row>
          </dl>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">Costos y margen</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm tabular-nums">
            <Row label="Ingreso">{usd(order.costs.revenueUsd)}</Row>
            <Row label="Impuestos">{usd(order.costs.taxUsd)}</Row>
            <Row label="IA">{usd(order.costs.aiUsd)}</Row>
            <Row label="Impresión y envío">{usd(order.costs.printUsd)}</Row>
            <Row label="Margen">
              <strong>{usd(order.costs.marginUsd)}</strong>
            </Row>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            Tipo de cambio del {order.costs.fxDate}. Sin comisiones de pago.
          </p>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">Imprenta y envío</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <Row label="Formatos">
              {order.items
                .map(
                  (item) =>
                    `${item.piece === 'book' ? '' : `${item.piece} `}${item.format} × ${String(item.quantity)}`,
                )
                .join(', ')}
            </Row>
            <Row label="Imprenta">{order.print?.provider ?? order.printProvider ?? '—'}</Row>
            <Row label="Pedido en la imprenta">{order.print?.externalOrderId ?? '—'}</Row>
            <Row label="Seguimiento">
              {order.print?.trackingUrl ? (
                <a
                  href={order.print.trackingUrl}
                  className="text-primary underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {order.print.trackingNumber ?? 'ver'}
                </a>
              ) : (
                (order.print?.trackingNumber ?? '—')
              )}
            </Row>
            <Row label="Destino">
              {order.shipping
                ? `${order.shipping.name}, ${order.shipping.city}${order.shipping.state ? `, ${order.shipping.state}` : ''} ${order.shipping.postalCode}, ${order.shipping.country}`
                : '—'}
            </Row>
          </dl>
          {order.printQuotes.length > 0 && (
            <ul className="mt-2 text-xs text-muted-foreground">
              {order.printQuotes.map((quote) => (
                <li key={quote.provider}>
                  {quote.provider}:{' '}
                  {quote.totalCostUsdMinor !== null
                    ? usd(quote.totalCostUsdMinor / 100)
                    : `sin cotización (${quote.error ?? '—'})`}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">
            Pipeline (generación {pipeline.pipeline.generation})
          </h2>
          {pipeline.pipeline.error && (
            <p className="mb-2 text-sm text-destructive">
              {pipeline.pipeline.failedStep}: {pipeline.pipeline.error}
            </p>
          )}
          <table className="w-full text-xs tabular-nums">
            <tbody>
              {pipeline.steps.map((step) => (
                <tr key={step.name} className="border-t first:border-0">
                  <td className="py-1 font-mono">{step.name}</td>
                  <td>{step.status}</td>
                  <td>{step.attempts} intentos</td>
                  <td>
                    {step.durationMs !== null ? `${(step.durationMs / 1000).toFixed(1)} s` : '—'}
                  </td>
                  <td>{usd(step.costUsdMicros / 1_000_000)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {order.qa.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              QA: {[...new Set(order.qa.map((event) => event.code))].join(', ')}
            </p>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 font-semibold">Acciones</h2>
        <div className="flex flex-wrap items-center gap-2">
          {order.status === 'qa_failed' && order.failedStep === 'quality_check' && (
            <Button
              disabled={busy}
              onClick={() =>
                void act(
                  '¿Aprobar las ilustraciones tal como están y seguir a la entrega?',
                  async () => {
                    await api('adminApproveOrder', { params });
                    return 'Aprobado: el pedido sigue a maqueta y entrega.';
                  },
                )
              }
            >
              Aprobar páginas
            </Button>
          )}
          {order.status === 'qa_failed' && (
            <>
              <select
                aria-label="Reintentar desde el paso"
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={fromStep}
                onChange={(event) => {
                  setFromStep(event.target.value as PipelineStep | '');
                }}
              >
                <option value="">Desde el paso que falló</option>
                {PIPELINE_STEPS.map((step) => (
                  <option key={step}>{step}</option>
                ))}
              </select>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void act('¿Reintentar el pipeline?', async () => {
                    await api('adminRetryOrderStep', {
                      params,
                      body: fromStep ? { fromStep } : {},
                    });
                    return 'Reintento pedido.';
                  })
                }
              >
                Reintentar
              </Button>
            </>
          )}
          {(order.status === 'qa_failed' || order.status === 'ready') && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void act(
                  '¿Armar el PDF del libro completo para revisarlo? No cambia el pedido ni gasta IA; tarda un minuto.',
                  async () => {
                    await api('adminPreviewBook', { params });
                    return 'Armando el libro: recarga el pedido en un minuto y aparece el enlace.';
                  },
                )
              }
            >
              Armar libro completo (PDF)
            </Button>
          )}
          {(order.status === 'qa_failed' || order.status === 'ready') && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void act(
                  '¿Regenerar todo el libro? Vuelve a pintar todas las páginas (costo de IA).',
                  async () => {
                    await api('adminRegenerateOrder', { params });
                    return 'Regeneración pedida.';
                  },
                )
              }
            >
              Regenerar libro
            </Button>
          )}
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void act('¿Reenviar al cliente el mail del estado actual?', async () => {
                const result = await api('adminResendEmail', { params });
                return result.detail;
              })
            }
          >
            Reenviar mail
          </Button>
          {printing && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void act('¿Cancelar en la imprenta?', async () => {
                  const result = await api('adminCancelPrint', { params });
                  return `Imprenta: ${result.status}.`;
                })
              }
            >
              Cancelar en la imprenta
            </Button>
          )}
          <Button
            variant="destructive"
            disabled={busy || order.status === 'refunded'}
            onClick={() => {
              const reason = window.prompt('Motivo del reembolso (queda en la auditoría):');
              if (!reason || reason.trim().length < 3) return;
              void act(
                `¿Reembolsar ${money(order.amounts.totalMinor, order.currency)}?`,
                async () => {
                  const result = await api('adminRefundOrder', { params, body: { reason } });
                  return `Reembolsado (${result.refundId}).`;
                },
              );
            }}
          >
            Reembolsar
          </Button>
        </div>
      </Card>

      {order.reference && (
        <Card className="mt-4">
          <h2 className="mb-1 font-semibold">Referencia: foto y personaje</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Para comparar el personaje con la persona real. Solo para revisar este pedido; los
            enlaces vencen en 15 minutos.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {order.reference.photos.map((url, index) => (
              <figure key={url} className="text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada de corta duración */}
                <img
                  src={url}
                  alt={`Foto ${String(index + 1)}`}
                  className="aspect-[3/4] w-full rounded-md border object-cover"
                />
                <figcaption className="mt-1 text-muted-foreground">Foto {index + 1}</figcaption>
              </figure>
            ))}
            {order.reference.character && (
              <figure className="text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada de corta duración */}
                <img
                  src={order.reference.character}
                  alt="Personaje aprobado"
                  className="aspect-[3/4] w-full rounded-md border object-cover"
                />
                <figcaption className="mt-1 font-semibold">Personaje aprobado</figcaption>
              </figure>
            )}
          </div>
          {order.reference.photos.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Sin fotos: se borraron (a los 30 días o a pedido) o el personaje se armó con rasgos.
            </p>
          )}
        </Card>
      )}

      {order.previewBook && (
        <Card className="mt-4">
          <h2 className="mb-1 font-semibold">Libro completo (PDF de revisión)</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            Tapa, páginas con su texto y cierre, tal como saldría. Armado el{' '}
            {order.previewBook.at ? new Date(order.previewBook.at).toLocaleString('es') : '—'}; el
            enlace vence en 15 minutos.
          </p>
          {order.previewBook.missing.length > 0 && (
            <p className="mb-2 text-sm text-destructive">
              Faltan ilustraciones (van con un marcador rosa):{' '}
              {order.previewBook.missing
                .map((index) => (index === 0 ? 'portada' : `página ${String(index)}`))
                .join(', ')}
              .
            </p>
          )}
          {order.previewBook.overflow.length > 0 && (
            <p className="mb-2 text-sm text-destructive">
              El texto no entra en: {order.previewBook.overflow.join(', ')}.
            </p>
          )}
          <a
            href={order.previewBook.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-primary underline"
          >
            Abrir el PDF
          </a>
        </Card>
      )}

      {order.pages.length > 0 && !showPages && (
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => {
            setShowPages(true);
          }}
        >
          Ver ilustraciones para la revisión
        </Button>
      )}
      {order.pages.length > 0 && showPages && (
        <Card className="mt-4">
          <h2 className="mb-1 font-semibold">Ilustraciones</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Imagen y texto de cada página, para revisar este pedido. Los enlaces vencen en 15
            minutos.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {order.pages.map((page) => (
              <figure key={page.index} className="text-xs">
                {page.url ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- URL firmada de corta duración */
                  <img
                    src={page.url}
                    alt={page.index === 0 ? 'Portada' : `Página ${String(page.index)}`}
                    className="aspect-[3/4] w-full rounded-md border object-cover"
                  />
                ) : (
                  <div className="grid aspect-[3/4] w-full place-items-center rounded-md border border-destructive bg-destructive/5 p-2 text-center text-destructive">
                    Sin ilustrar: {page.error}
                  </div>
                )}
                <figcaption className="mt-1 text-muted-foreground">
                  <span className="font-semibold">
                    {page.index === 0 ? 'Portada' : `Página ${String(page.index)}`}
                  </span>
                  {page.text && <span className="mt-0.5 block text-foreground">{page.text}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function OrderPageInner() {
  const id = useSearchParams().get('id');
  if (!id) return <Notice tone="error">Falta el número de pedido.</Notice>;
  return <OrderDetail id={id} />;
}

export default function OrderPage() {
  return (
    <Suspense fallback={<p role="status">Cargando…</p>}>
      <OrderPageInner />
    </Suspense>
  );
}
