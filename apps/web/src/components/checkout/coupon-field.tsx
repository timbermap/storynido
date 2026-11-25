'use client';

import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

/** Código que trajo la visita (?cupon=, ?coupon=, ?cupom=), guardado solo en esta pestaña. */
export const COUPON_STORAGE_KEY = 'storynido:coupon';
const COUPON_PARAMS = ['cupon', 'coupon', 'cupom'] as const;

export function normalizeCoupon(raw: string | null | undefined): string | null {
  const value = raw?.trim().toUpperCase().slice(0, 40);
  return value && /^[A-Z0-9_-]+$/.test(value) ? value : null;
}

export function couponFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  for (const key of COUPON_PARAMS) {
    const code = normalizeCoupon(params.get(key));
    if (code) return code;
  }
  return null;
}

/** El código que trajo el enlace de esta visita, si hay. */
export function rememberedCoupon(): string | null {
  if (typeof window === 'undefined') return null;
  const fromUrl = couponFromSearch(window.location.search);
  if (fromUrl) return fromUrl;
  try {
    return normalizeCoupon(window.sessionStorage.getItem(COUPON_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Guarda en la pestaña el código de un enlace (?cupon=CODIGO) apenas entra la visita, para
 * aplicarlo solo al llegar al pago. sessionStorage: sin cookies ni datos personales.
 */
export function RememberCoupon() {
  useEffect(() => {
    const code = couponFromSearch(window.location.search);
    if (!code) return;
    try {
      window.sessionStorage.setItem(COUPON_STORAGE_KEY, code);
    } catch {
      // Sin storage (modo privado): el pago igual lee el parámetro si sigue en la URL.
    }
  }, []);
  return null;
}

/**
 * Cupón discreto (DECISIONS 324): un campo de cupón visible hace sentir que hay un precio más
 * bajo y manda a buscar códigos afuera. Queda como un enlace chico debajo del total; si la visita
 * llegó con un código (enlace de una campaña o de una amiga) se aplica solo y se muestra aplicado.
 */
export function CouponField({
  coupon,
  error,
  onApply,
  id,
}: {
  coupon: string | null;
  error: string | null | undefined;
  /** Debe ser estable (el setState del pago): se llama solo al montar con el código del enlace. */
  onApply: (code: string | null) => void;
  id: string;
}) {
  const t = useTranslations('Checkout');
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');

  // Aplica solo el código que trajo el enlace (una vez, al montar).
  useEffect(() => {
    const code = rememberedCoupon();
    if (code) onApply(code);
  }, [onApply]);

  const forget = () => {
    try {
      window.sessionStorage.removeItem(COUPON_STORAGE_KEY);
    } catch {
      // Sin storage: nada que borrar.
    }
  };

  if (coupon && !error) {
    return (
      <p className="flex items-center justify-between gap-3 rounded-xl bg-mint-soft px-3 py-2 text-sm">
        <span className="flex items-center gap-2">
          <Check className="size-4 text-primary" aria-hidden="true" />
          {t('couponApplied', { code: coupon })}
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => {
            forget();
            setInput('');
            setOpen(false);
            onApply(null);
          }}
        >
          <X className="size-3" aria-hidden="true" />
          {t('couponRemove')}
        </button>
      </p>
    );
  }

  if (!open && !error) {
    return (
      <button
        type="button"
        className="justify-self-start text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        aria-expanded={false}
        aria-controls={id}
        onClick={() => {
          setOpen(true);
        }}
      >
        {t('couponToggle')}
      </button>
    );
  }

  return (
    <div className="grid gap-2">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onApply(normalizeCoupon(input));
        }}
      >
        <label htmlFor={id} className="sr-only">
          {t('coupon')}
        </label>
        <input
          id={id}
          autoFocus
          placeholder={t('couponPlaceholder')}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
          }}
          className="h-9 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm uppercase placeholder:normal-case"
        />
        <Button type="submit" variant="outline" size="sm">
          {t('apply')}
        </Button>
      </form>
      {error && (
        <p role="status" className="text-sm text-destructive">
          {t(`couponErrors.${error}`)}
        </p>
      )}
    </div>
  );
}
