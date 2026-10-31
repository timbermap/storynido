'use client';

import { BookOpen, ChevronRight, RotateCcw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { GENERATED_STATUSES, OrderTimeline, isPrintOrder } from '@/components/orders/timeline';
import { Link } from '@/i18n/navigation';
import { subscribeOrders, type OrderSummary } from '@/lib/firebase/account';
import { getFirebaseDb } from '@/lib/firebase/client';

/** Mis pedidos, en vivo: cada cambio del pipeline o de la imprenta se ve sin recargar. */
export function OrdersList({ uid }: { uid: string }) {
  const t = useTranslations('Account.orders');
  const tOrder = useTranslations('Checkout.order');
  const tFormats = useTranslations('Checkout.formats');
  const date = new Intl.DateTimeFormat(useLocale(), { dateStyle: 'medium' });
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void getFirebaseDb().then((db) => {
      if (cancelled) return;
      unsubscribe = subscribeOrders(db, uid, setOrders, () => {
        setFailed(true);
      });
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [uid]);

  // Los pagos que nunca se completaron no son pedidos para quien compra.
  const visible = orders?.filter((order) => order.status !== 'cancelled' || order.title);
  // Sin pedidos no hay nada que mostrar: la sección aparece cuando hay el primero.
  if (!failed && visible?.length === 0) return null;

  return (
    <section id="orders" className="grid scroll-mt-28 gap-4">
      <h2 className="text-2xl font-medium">{t('title')}</h2>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {t('error')}
        </p>
      ) : visible === undefined ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t('loading')}
        </p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="grid gap-3">
          {visible.map((order) => {
            const print = isPrintOrder(order.items);
            const format = order.items[0]?.format ?? 'digital';
            return (
              <li key={order.id} className="grid gap-3 rounded-2xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <BookOpen className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{order.title ?? t('untitled')}</p>
                    <p className="text-sm text-muted-foreground">
                      {tFormats(`${format}.name`)}
                      {order.createdAt && ` · ${date.format(order.createdAt)}`}
                    </p>
                  </div>
                  <Link
                    href={{ pathname: '/order/[orderId]', params: { orderId: order.id } }}
                    className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline"
                  >
                    {t('view')}
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
                <p className="text-sm">{tOrder(`status.${order.status}`)}</p>
                <OrderTimeline status={order.status} print={print} compact />
                {GENERATED_STATUSES.has(order.status) && (
                  <Link
                    href={{
                      pathname: '/checkout/[bookId]',
                      params: { bookId: order.bookId },
                      query: { reorder: order.id },
                    }}
                    className="flex items-center gap-1.5 justify-self-start text-sm font-semibold text-primary hover:underline"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    {tOrder('reorder')}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
