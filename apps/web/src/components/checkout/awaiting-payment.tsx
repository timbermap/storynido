'use client';

import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useSyncExternalStore } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';

import { readPaymentUrl } from './payment-url';

const noSubscription = () => () => undefined;

/**
 * Pedido esperando el pago que se hace en otra pestaña (Gumroad): la página consulta sola y pasa a
 * «pago confirmado» cuando llega el aviso del cobrador. Deja volver a abrir el pago y un «Ya pagué»
 * que consulta en el momento (DECISIONS 271).
 */
export function AwaitingPayment({ orderId, onCheck }: { orderId: string; onCheck: () => void }) {
  const t = useTranslations('Checkout.order.awaiting');
  // sessionStorage solo existe en el navegador: en el servidor no hay enlace para reabrir.
  const paymentUrl = useSyncExternalStore(
    noSubscription,
    () => readPaymentUrl(orderId),
    () => null,
  );
  const [checked, setChecked] = useState(false);

  return (
    <section
      aria-labelledby="awaiting-payment-title"
      className="grid gap-4 rounded-2xl border bg-card p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <Loader2 className="mt-1 size-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
        <div>
          <h2 id="awaiting-payment-title" className="font-semibold">
            {t('title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('text')}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => {
            setChecked(true);
            onCheck();
          }}
        >
          <RefreshCw aria-hidden="true" />
          {t('paid')}
        </Button>
        {paymentUrl && (
          <a
            href={paymentUrl}
            target="_blank"
            rel="noopener"
            className={buttonVariants({ variant: 'ghost' })}
          >
            <ExternalLink aria-hidden="true" />
            {t('reopen')}
          </a>
        )}
      </div>
      {checked && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('notYet')}
        </p>
      )}
    </section>
  );
}
