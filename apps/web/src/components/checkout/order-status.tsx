'use client';

import { ApiError, type CountryCode, type PublicOrder } from '@storynido/shared';
import { Check, CircleDashed, FlaskConical, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

import { PriceSummary } from './price-summary';

const STEPS = ['pending_payment', 'paid', 'generating', 'ready'] as const;
const FINAL = new Set(['ready', 'delivered', 'qa_failed', 'cancelled', 'refunded', 'shipped']);

/** Estado del pedido, en vivo: se consulta cada pocos segundos hasta que se resuelve. */
export function OrderStatus({ orderId, country }: { orderId: string; country: CountryCode }) {
  const t = useTranslations('Checkout.order');
  const { signedIn, loading } = useAuth();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const current = await api('order', { params: { orderId } });
        if (cancelled) return;
        setOrder(current);
        if (!FINAL.has(current.status)) timer = setTimeout(() => void load(), 4000);
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

  async function simulate() {
    setSimulating(true);
    try {
      setOrder(await api('devSimulatePayment', { params: { orderId } }));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('error'));
    } finally {
      setSimulating(false);
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
      <p role="alert" className="text-destructive font-semibold">
        {error}
      </p>
    );
  }

  const current = STEPS.indexOf(order.status as (typeof STEPS)[number]);
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid content-start gap-6">
        <p role="status" aria-live="polite" className="text-xl font-medium">
          {t(`status.${order.status}`)}
        </p>
        {current >= 0 && (
          <ol className="grid gap-3">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-center gap-3">
                <span
                  className={cn(
                    'grid size-7 place-items-center rounded-full border-2',
                    index < current && 'border-primary bg-primary text-primary-foreground',
                    index === current && 'border-primary text-primary',
                    index > current && 'border-border text-muted-foreground',
                  )}
                >
                  {index < current ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : index === current && step !== 'ready' ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CircleDashed className="size-4" aria-hidden="true" />
                  )}
                </span>
                <span className={index > current ? 'text-muted-foreground' : 'font-semibold'}>
                  {t(`steps.${step}`)}
                </span>
              </li>
            ))}
          </ol>
        )}
        {order.canSimulatePayment && (
          <div className="rounded-2xl border border-dashed bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <FlaskConical className="size-4" aria-hidden="true" />
              {t('simulateTitle')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t('simulateText')}</p>
            <Button
              className="mt-3"
              size="sm"
              disabled={simulating}
              onClick={() => void simulate()}
            >
              {simulating && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t('simulate')}
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm font-semibold">
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
