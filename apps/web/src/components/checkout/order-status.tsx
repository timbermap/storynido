'use client';

import { ApiError, type CountryCode, type PublicOrder } from '@storynido/shared';
import { Download, FlaskConical, Loader2, RotateCcw, Truck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import {
  GENERATED_STATUSES,
  OrderTimeline,
  SETTLED_STATUSES,
  isPrintOrder,
} from '@/components/orders/timeline';
import { Button, buttonVariants } from '@/components/ui/button';
import { OrderReview } from '@/components/orders/order-review';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';

import { PriceSummary } from './price-summary';

/** Mientras el libro está en la imprenta los cambios llegan en días: se consulta más espaciado. */
const AT_PRINTER = new Set(['sent_to_print', 'in_production', 'shipped']);

/** Estado del pedido, en vivo: se consulta cada pocos segundos hasta que se resuelve. */
export function OrderStatus({ orderId, country }: { orderId: string; country: CountryCode }) {
  const t = useTranslations('Checkout.order');
  const { signedIn, loading } = useAuth();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const tKit = useTranslations('Checkout.kit');

  useEffect(() => {
    if (!signedIn) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const current = await api('order', { params: { orderId } });
        if (cancelled) return;
        setOrder(current);
        const print = isPrintOrder(current.items);
        const done = SETTLED_STATUSES.has(current.status) || (!print && current.status === 'ready');
        if (!done) {
          timer = setTimeout(() => void load(), AT_PRINTER.has(current.status) ? 30_000 : 4000);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : t('error'));
      }
    };
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderId, signedIn, t]);

  async function run(kind: 'payment' | 'print' | 'download', file = 'book') {
    setBusy(kind === 'download' ? `download:${file}` : kind);
    setError(null);
    try {
      if (kind === 'payment') {
        setOrder(await api('devSimulatePayment', { params: { orderId } }));
      } else if (kind === 'print') {
        await api('devSimulatePrint', { params: { orderId } });
        setOrder(await api('order', { params: { orderId } }));
      } else {
        const { url } = await api('orderDownload', {
          params: { orderId },
          query: { file: file as 'book' },
        });
        window.location.assign(url);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('error'));
    } finally {
      setBusy(null);
    }
  }

  if (loading || (!order && !error)) {
    return (
      <p role="status" className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {t('loading')}
      </p>
    );
  }
  if (!order) {
    return (
      <p role="alert" className="font-semibold text-destructive">
        {error}
      </p>
    );
  }

  const print = isPrintOrder(order.items);
  // Eventos: el kit con sus piezas, para descargar de a una o todo junto.
  const kitFiles = order.files.filter((file) => file !== 'book' && file !== 'kit_zip');
  const isKit = order.files.includes('kit_zip');
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid content-start gap-6">
        <p role="status" aria-live="polite" className="text-xl font-medium">
          {isKit && order.status === 'ready' ? tKit('ready') : t(`status.${order.status}`)}
        </p>
        <OrderTimeline status={order.status} print={print} />

        {(order.canDownload ||
          Boolean(order.tracking?.url) ||
          GENERATED_STATUSES.has(order.status)) && (
          <div className="flex flex-wrap gap-3">
            {order.canDownload && isKit && (
              <Button disabled={busy !== null} onClick={() => void run('download', 'kit_zip')}>
                {busy === 'download:kit_zip' ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Download aria-hidden="true" />
                )}
                {tKit('downloadAll')}
              </Button>
            )}
            {order.canDownload && !isKit && (
              <Button disabled={busy !== null} onClick={() => void run('download')}>
                {busy === 'download:book' ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Download aria-hidden="true" />
                )}
                {t('download')}
              </Button>
            )}
            {order.tracking?.url && (
              <a
                href={order.tracking.url}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: 'outline' })}
              >
                <Truck aria-hidden="true" />
                {t('track')}
              </a>
            )}
            {GENERATED_STATUSES.has(order.status) && (
              <Link
                href={{
                  pathname: '/checkout/[bookId]',
                  params: { bookId: order.bookId },
                  query: isKit ? { reorder: order.orderId, kit: '1' } : { reorder: order.orderId },
                }}
                className={buttonVariants({ variant: 'outline' })}
              >
                <RotateCcw aria-hidden="true" />
                {isKit ? tKit('moreCopies') : t('reorder')}
              </Link>
            )}
          </div>
        )}
        {order.canDownload && isKit && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {['book', ...kitFiles].map((file) => (
              <li key={file}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void run('download', file)}
                  className="flex w-full items-center gap-2 rounded-xl border bg-card px-4 py-3 text-left text-sm font-semibold hover:border-primary/40 disabled:opacity-60"
                >
                  {busy === `download:${file}` ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="size-4 text-primary" aria-hidden="true" />
                  )}
                  {order.canReview && (
                    <OrderReview orderId={order.orderId} initial={order.review} />
                  )}
                  {tKit(`pieces.${file === 'book' ? 'mini_book' : file}.name`)}
                </button>
              </li>
            ))}
          </ul>
        )}
        {order.tracking?.number && (
          <p className="text-sm text-muted-foreground">
            {t('trackingNumber', { number: order.tracking.number })}
          </p>
        )}

        {(order.canSimulatePayment || order.canSimulatePrint) && (
          <div className="rounded-2xl border border-dashed bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <FlaskConical className="size-4" aria-hidden="true" />
              {t('simulateTitle')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {order.canSimulatePayment ? t('simulateText') : t('simulatePrintText')}
            </p>
            <Button
              className="mt-3"
              size="sm"
              disabled={busy !== null}
              onClick={() => void run(order.canSimulatePayment ? 'payment' : 'print')}
            >
              {(busy === 'payment' || busy === 'print') && (
                <Loader2 className="animate-spin" aria-hidden="true" />
              )}
              {order.canSimulatePayment ? t('simulate') : t('simulatePrint')}
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        )}
      </div>
      {order.priceSnapshot && (
        <aside className="self-start rounded-2xl border bg-card p-6">
          <PriceSummary snapshot={order.priceSnapshot} country={country} />
        </aside>
      )}
    </div>
  );
}
