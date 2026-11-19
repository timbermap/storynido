'use client';

import { CreditCard, Lock, ReceiptText, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';

import { paypalOrderId } from './payment-url';

/**
 * PayPal dentro de StoryNido (DECISIONS 287): los botones oficiales de PayPal en un diálogo sobre
 * nuestra página. «PayPal» abre una ventanita encima; «Tarjeta de débito o crédito» despliega el
 * formulario de tarjeta acá mismo, sin cuenta de PayPal. La orden ya la creó la API: los botones
 * solo la aprueban, y al aprobar la API cobra y confirma en el momento (el webhook queda de red).
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? '';

/** ¿Se puede pagar este enlace sin salir de la página? */
export function canPayInPage(url: string): boolean {
  return CLIENT_ID !== '' && paypalOrderId(url) !== null;
}

interface PaypalButtonsInstance {
  isEligible(): boolean;
  render(container: HTMLElement): Promise<void>;
  close(): Promise<void>;
}

interface PaypalNamespace {
  FUNDING: { PAYPAL: string; CARD: string };
  Buttons(options: {
    fundingSource?: string;
    style?: Record<string, string | number | boolean>;
    createOrder: () => string;
    onApprove: () => Promise<void>;
    onCancel?: () => void;
    onError?: (error: unknown) => void;
  }): PaypalButtonsInstance;
}

let sdk: Promise<PaypalNamespace> | null = null;

function loadSdk(): Promise<PaypalNamespace> {
  sdk ??= new Promise<PaypalNamespace>((resolve, reject) => {
    const params = new URLSearchParams({
      'client-id': CLIENT_ID,
      currency: 'USD',
      intent: 'capture',
      components: 'buttons',
      'disable-funding': 'paylater,credit',
    });
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.async = true;
    script.dataset.namespace = 'storynidoPaypal';
    script.onload = () => {
      const ns = (window as unknown as { storynidoPaypal?: PaypalNamespace }).storynidoPaypal;
      if (ns) resolve(ns);
      else reject(new Error('PayPal SDK sin namespace'));
    };
    script.onerror = () => {
      sdk = null;
      script.remove();
      reject(new Error('No cargó el SDK de PayPal'));
    };
    document.head.appendChild(script);
  });
  return sdk;
}

export function PaypalCheckoutDialog({
  orderId,
  checkoutUrl,
  onClose,
}: {
  orderId: string;
  checkoutUrl: string;
  onClose: () => void;
}) {
  const t = useTranslations('Checkout.paypal');
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const paypalSlot = useRef<HTMLDivElement>(null);
  const cardSlot = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'confirming' | 'failed'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [cardEligible, setCardEligible] = useState(true);
  const token = paypalOrderId(checkoutUrl);

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

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    // Función: después de cada await se vuelve a mirar (el diálogo pudo cerrarse mientras tanto).
    const stopped = () => cancelled;
    const rendered: PaypalButtonsInstance[] = [];

    const approve = async () => {
      setState('confirming');
      try {
        await api('confirmPayment', { params: { orderId } });
      } catch {
        // Si la confirmación inmediata falla, el webhook la hace igual: la página del pedido espera.
      }
      router.push({ pathname: '/order/[orderId]', params: { orderId } });
    };

    loadSdk()
      .then(async (paypal) => {
        if (stopped()) return;
        const common = {
          createOrder: () => token,
          onApprove: approve,
          onCancel: () => {
            setError(null);
          },
          onError: () => {
            setError(t('error'));
          },
        };
        const wallet = paypal.Buttons({
          ...common,
          fundingSource: paypal.FUNDING.PAYPAL,
          style: { layout: 'vertical', shape: 'pill', color: 'gold', label: 'pay', height: 48 },
        });
        const card = paypal.Buttons({
          ...common,
          fundingSource: paypal.FUNDING.CARD,
          style: { layout: 'vertical', shape: 'pill', color: 'black', height: 48 },
        });
        if (paypalSlot.current && wallet.isEligible()) {
          rendered.push(wallet);
          await wallet.render(paypalSlot.current);
        }
        const cardOk = card.isEligible();
        setCardEligible(cardOk);
        if (cardSlot.current && cardOk) {
          rendered.push(card);
          await card.render(cardSlot.current);
        }
        if (!stopped()) setState('ready');
      })
      .catch(() => {
        if (!stopped()) setState('failed');
      });

    return () => {
      cancelled = true;
      for (const buttons of rendered) void buttons.close().catch(() => undefined);
    };
  }, [token, orderId, router, t]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-navy/40 p-4 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget && state !== 'confirming') onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="paypal-checkout-title"
        tabIndex={-1}
        className="relative my-auto grid w-full max-w-md gap-5 rounded-2xl bg-card p-6 shadow-[var(--shadow-card)] outline-none sm:p-7"
      >
        {state !== 'confirming' && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        )}
        <div className="pr-8">
          <h2 id="paypal-checkout-title" className="text-xl font-medium">
            {t('title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('text')}</p>
        </div>

        {state === 'confirming' ? (
          <p role="status" className="rounded-xl bg-muted p-4 text-sm">
            {t('confirming')}
          </p>
        ) : (
          <>
            <ul className="grid gap-3 text-sm">
              <li className="flex gap-3">
                <CreditCard className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                {cardEligible ? t('noAccount') : t('noAccountUnavailable')}
              </li>
              <li className="flex gap-3">
                <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                {t('secure')}
              </li>
              <li className="flex gap-3">
                <ReceiptText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                {t('statement')}
              </li>
            </ul>

            {state === 'loading' && (
              <p role="status" className="text-sm text-muted-foreground">
                {t('loading')}
              </p>
            )}
            {state === 'failed' ? (
              <p className="rounded-xl bg-muted p-4 text-sm">
                {t.rich('failed', {
                  link: (chunks) => (
                    <a className="font-medium underline" href={checkoutUrl}>
                      {chunks}
                    </a>
                  ),
                })}
              </p>
            ) : (
              <div className="grid gap-3">
                <div ref={paypalSlot} />
                <div ref={cardSlot} />
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
