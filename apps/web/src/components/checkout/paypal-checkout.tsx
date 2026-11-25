'use client';

import { ApiError } from '@storynido/shared';
import { CreditCard, Loader2, Lock, ReceiptText, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
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

interface PaypalActions {
  /** Vuelve a elegir el medio de pago de la misma orden (tarjeta rechazada). */
  restart(): Promise<void>;
}

interface PaypalNamespace {
  FUNDING: { PAYPAL: string; CARD: string };
  Buttons(options: {
    fundingSource?: string;
    style?: Record<string, string | number | boolean>;
    createOrder: () => string;
    onApprove: (data: unknown, actions: PaypalActions) => Promise<void>;
    onCancel?: () => void;
    onError?: (error: unknown) => void;
  }): PaypalButtonsInstance;
}

let sdk: Promise<PaypalNamespace> | null = null;

/** Idioma de los botones de PayPal (los mismos que usa la API al crear la orden). */
const SDK_LOCALES: Record<string, string> = { es: 'es_MX', pt: 'pt_BR', en: 'en_US' };

function loadSdk(locale: string): Promise<PaypalNamespace> {
  sdk ??= new Promise<PaypalNamespace>((resolve, reject) => {
    const params = new URLSearchParams({
      'client-id': CLIENT_ID,
      locale: SDK_LOCALES[locale] ?? 'en_US',
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
  const locale = useLocale();
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const paypalSlot = useRef<HTMLDivElement>(null);
  const cardSlot = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'confirming' | 'failed'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [cardEligible, setCardEligible] = useState(true);
  const token = paypalOrderId(checkoutUrl);
  const confirming = state === 'confirming';
  const confirmingRef = useRef(false);
  useEffect(() => {
    confirmingRef.current = confirming;
  }, [confirming]);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirmingRef.current) onClose();
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

    const approve = async (_data: unknown, actions: PaypalActions) => {
      // Apenas PayPal aprueba se muestra «confirmando»: mientras la API cobra (unos segundos) no
      // vuelven a verse los botones de PayPal y tarjeta, que hacían creer que el pago no salió.
      setError(null);
      setState('confirming');
      try {
        await api('confirmPayment', { params: { orderId } });
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === 'payment_declined') {
          // La tarjeta se aprobó pero se rechazó al cobrar: PayPal deja elegir otra sobre la misma
          // orden (actions.restart); si no se puede, queda el aviso para volver a intentar.
          setState('ready');
          setError(t('declined'));
          await actions.restart().catch(() => undefined);
          return;
        }
        // Otro fallo de la confirmación inmediata: el webhook la hace igual, la página espera.
      }
      router.push({ pathname: '/order/[orderId]', params: { orderId } });
    };

    loadSdk(locale)
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
        const cardOk = card.isEligible();
        setCardEligible(cardOk);
        if (cardSlot.current && cardOk) {
          rendered.push(card);
          await card.render(cardSlot.current);
        }
        if (paypalSlot.current && wallet.isEligible()) {
          rendered.push(wallet);
          await wallet.render(paypalSlot.current);
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
  }, [token, orderId, router, t, locale]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-navy/40 p-4 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget && !confirming) onClose();
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
        {!confirming && (
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

        {confirming && (
          <p role="status" className="flex items-start gap-3 rounded-xl bg-mint-soft p-4 text-sm">
            <Loader2
              className="mt-0.5 size-4 shrink-0 animate-spin text-primary"
              aria-hidden="true"
            />
            {t('confirming')}
          </p>
        )}
        {/* Los botones siguen montados (ocultos) al confirmar: si la tarjeta se rechaza, PayPal
            los reusa para elegir otra. */}
        <div className={confirming ? 'hidden' : 'contents'}>
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
              <div ref={cardSlot} />
              <div ref={paypalSlot} />
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
