'use client';

import { CreditCard, Lock, ReceiptText, Undo2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';

import { isExternalTabPayment, rememberPaymentUrl } from './payment-url';
import { canPayInPage, PaypalCheckoutDialog } from './paypal-checkout';

interface Pending {
  orderId: string;
  checkoutUrl: string;
}

/**
 * Pasa del botón «Pagar» al cobrador. Con PayPal, los botones de pago se abren en un diálogo sobre
 * esta página (DECISIONS 286). Con un cobrador que vuelve solo (Dodo, el simulado) va directo. Con Gumroad, antes explica en un diálogo qué va a ver (tarjeta, sin crear cuenta) y,
 * con el clic en «Ir a pagar», abre Gumroad en otra pestaña y lleva esta a la página del pedido,
 * que se actualiza sola cuando llega la confirmación del pago.
 */
export function usePaymentHandoff(
  /** El diálogo se cerró sin ir a pagar: el botón «Pagar» vuelve a estar disponible. */
  onDismiss: () => void,
): { start: (result: Pending) => void; dialog: ReactNode } {
  const [pending, setPending] = useState<Pending | null>(null);
  const [inPage, setInPage] = useState<Pending | null>(null);
  const router = useRouter();

  function start(result: Pending) {
    if (canPayInPage(result.checkoutUrl)) {
      setInPage(result);
      return;
    }
    if (!isExternalTabPayment(result.checkoutUrl)) {
      window.location.assign(result.checkoutUrl);
      return;
    }
    rememberPaymentUrl(result.orderId, result.checkoutUrl);
    setPending(result);
  }

  function go() {
    if (!pending) return;
    // Dentro del clic: el navegador no lo bloquea como ventana emergente. Si igual se bloqueara,
    // la página del pedido tiene el botón para abrir el pago.
    window.open(pending.checkoutUrl, '_blank', 'noopener');
    router.push({ pathname: '/order/[orderId]', params: { orderId: pending.orderId } });
  }

  function close() {
    setPending(null);
    setInPage(null);
    onDismiss();
  }

  const dialog = inPage ? (
    <PaypalCheckoutDialog
      orderId={inPage.orderId}
      checkoutUrl={inPage.checkoutUrl}
      onClose={close}
    />
  ) : pending ? (
    <PaymentHandoffDialog onGo={go} onClose={close} />
  ) : null;
  return { start, dialog };
}

function PaymentHandoffDialog({ onGo, onClose }: { onGo: () => void; onClose: () => void }) {
  const t = useTranslations('Checkout.handoff');
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-navy/40 p-4 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-handoff-title"
        tabIndex={-1}
        className="relative grid w-full max-w-md gap-5 rounded-2xl bg-card p-6 shadow-[var(--shadow-card)] outline-none sm:p-7"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
        <div className="pr-8">
          <h2 id="payment-handoff-title" className="text-xl font-medium">
            {t('title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('text')}</p>
        </div>
        <ul className="grid gap-3 text-sm">
          <li className="flex gap-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            {t('noAccount')}
          </li>
          <li className="flex gap-3">
            <CreditCard className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            {t('methods')}
          </li>
          <li className="flex gap-3">
            <ReceiptText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            {t('statement')}
          </li>
          <li className="flex gap-3">
            <Undo2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            {t('comeBack')}
          </li>
        </ul>
        <Button size="lg" onClick={onGo}>
          {t('go')}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
