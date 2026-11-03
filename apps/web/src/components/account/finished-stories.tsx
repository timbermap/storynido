'use client';

import { BookOpen, ChevronRight, RotateCcw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { LineBadge } from '@/components/wizard/drafts-list';
import { isOrderDone } from '@/components/layout/use-account-activity';
import { Link } from '@/i18n/navigation';
import { subscribeOrders, type OrderSummary } from '@/lib/firebase/account';
import { getFirebaseDb } from '@/lib/firebase/client';

/**
 * Cuentos terminados: los pedidos entregados, o digitales y listos, sin importar la línea. Los
 * que todavía están en camino (también los impresos en la imprenta) van en En curso.
 */
export function FinishedStories({
  uid,
  heading = true,
  emptyLabel,
}: {
  uid: string;
  /** Sin título dentro de la solapa Terminados de Mis cuentos, que ya lo nombra. */
  heading?: boolean;
  /** Sin pedidos terminados se avisa con este texto en lugar de ocultar la sección. */
  emptyLabel?: string;
}) {
  const t = useTranslations('Account.myStories');
  const tFormats = useTranslations('Checkout.formats');
  const tOrder = useTranslations('Checkout.order');
  const date = new Intl.DateTimeFormat(useLocale(), { dateStyle: 'medium' });
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void getFirebaseDb().then((db) => {
      if (cancelled) return;
      unsubscribe = subscribeOrders(db, uid, setOrders, () => {
        setOrders([]);
      });
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [uid]);

  const finished = orders?.filter(isOrderDone) ?? [];
  if (orders === null && emptyLabel) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t('loading')}
      </p>
    );
  }
  if (finished.length === 0) {
    return emptyLabel ? <p className="text-sm text-muted-foreground">{emptyLabel}</p> : null;
  }

  return (
    <section
      id="finished"
      aria-labelledby={heading ? 'finished-title' : undefined}
      className="grid scroll-mt-28 gap-4"
    >
      {heading && (
        <h2 id="finished-title" className="text-2xl font-medium">
          {t('finished')} ({finished.length})
        </h2>
      )}
      <ul className="grid gap-3">
        {finished.map((order) => (
          <li
            key={order.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-card p-4"
          >
            <BookOpen className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <LineBadge line={order.channel} />
              <p className="truncate font-semibold">{order.title ?? t('finishedUntitled')}</p>
              <p className="text-sm text-muted-foreground">
                {tFormats(`${order.items[0]?.format ?? 'digital'}.name`)}
                {order.createdAt && ` · ${date.format(order.createdAt)}`}
                {` · ${tOrder(`status.${order.status}`)}`}
              </p>
            </div>
            <Link
              href={{
                pathname: '/checkout/[bookId]',
                params: { bookId: order.bookId },
                query: { reorder: order.id },
              }}
              className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              {tOrder('reorder')}
            </Link>
            <Link
              href={{ pathname: '/order/[orderId]', params: { orderId: order.id } }}
              className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              {t('view')}
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
