'use client';

import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

import { readPaymentUrl } from './payment-url';

/** Si el pago sigue sin confirmarse pasado este tiempo, se ofrece ayuda. */
const SLOW_AFTER_MS = 3 * 60 * 1000;
/** «Ya pagué»: si en este tiempo la consulta no trajo el pago, se avisa que puede tardar. */
const NOT_YET_AFTER_MS = 6000;

const noSubscription = () => () => undefined;

/**
 * Pedido esperando el pago que se hace en otra pestaña (Gumroad): la página consulta sola y pasa a
 * «pago confirmado» cuando llega el aviso del cobrador. Deja volver a abrir el pago, un «Ya pagué»
 * que consulta en el momento y, si tarda, ayuda (DECISIONS 271 y 272). Al confirmarse el pago este
 * bloque desaparece, así que los avisos solo se ven mientras sigue pendiente.
 */
export function AwaitingPayment({ orderId, onCheck }: { orderId: string; onCheck: () => void }) {
  const t = useTranslations('Checkout.order.awaiting');
  // sessionStorage solo existe en el navegador: en el servidor no hay enlace para reabrir.
  const paymentUrl = useSyncExternalStore(
    noSubscription,
    () => readPaymentUrl(orderId),
    () => null,
  );
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [notYet, setNotYet] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSlow(true);
    }, SLOW_AFTER_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (checkedAt === null) return;
    const timer = setTimeout(() => {
      setNotYet(true);
    }, NOT_YET_AFTER_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [checkedAt]);

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
            setNotYet(false);
            setCheckedAt(Date.now());
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
      {notYet && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('notYet')}
        </p>
      )}
      {slow && (
        <p className="text-sm">
          {t.rich('slow', {
            link: (chunks) => (
              <Link href="/faq" className="font-semibold text-primary underline underline-offset-4">
                {chunks}
              </Link>
            ),
          })}
        </p>
      )}
    </section>
  );
}
