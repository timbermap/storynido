'use client';

import {
  ApiError,
  type Address,
  type BookFormat,
  type CountryCode,
  type Locale,
  type Offer,
  type PriceSnapshot,
} from '@storynido/shared';
import { Gift, Loader2, Lock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { SignInPanel } from '@/components/auth/sign-in-panel';
import { useAuth } from '@/components/auth/auth-provider';
import { useConsent } from '@/components/consent/consent-provider';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

import { PriceSummary } from './price-summary';

type AddressDraft = Omit<Address, 'country'>;

const EMPTY_ADDRESS: AddressDraft = {
  name: '',
  line1: '',
  line2: null,
  city: '',
  state: null,
  postalCode: '',
  phone: null,
};

const ADDRESS_FIELDS: { key: keyof AddressDraft; optional?: boolean; autoComplete: string }[] = [
  { key: 'name', autoComplete: 'name' },
  { key: 'line1', autoComplete: 'address-line1' },
  { key: 'line2', optional: true, autoComplete: 'address-line2' },
  { key: 'city', autoComplete: 'address-level2' },
  { key: 'state', autoComplete: 'address-level1' },
  { key: 'postalCode', autoComplete: 'postal-code' },
  { key: 'phone', autoComplete: 'tel' },
];

/**
 * Checkout: formato, dirección (si es impreso), regalo y cupón. El precio lo calcula siempre
 * la API; acá solo se muestra. Pagar crea el pedido y lleva al procesador de pagos.
 */
export function Checkout({
  bookId,
  offer,
  country,
}: {
  bookId: string;
  offer: Offer;
  country: CountryCode;
}) {
  const t = useTranslations('Checkout');
  const locale = useLocale() as Locale;
  const { signedIn, loading } = useAuth();
  const { choice } = useConsent();
  const formats = offer.formats;
  const [format, setFormat] = useState<BookFormat>(formats[0]?.format ?? 'digital');
  const [address, setAddress] = useState<AddressDraft>(EMPTY_ADDRESS);
  const [gift, setGift] = useState({ isGift: false, message: '' });
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<string | null>(null);
  const [quote, setQuote] = useState<{
    snapshot: PriceSnapshot;
    couponError: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const print = format !== 'digital';

  // El resumen se recalcula en el servidor cada vez que cambia el formato o el cupón.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    api('checkoutQuote', { body: { bookId, format, country, quantity: 1, couponCode: coupon } })
      .then((result) => {
        if (!cancelled) setQuote(result);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : t('errors.generic'));
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, format, country, coupon, signedIn, t]);

  async function pay() {
    setPaying(true);
    setError(null);
    try {
      const { checkoutUrl } = await api('createCheckout', {
        body: {
          bookId,
          format,
          country,
          quantity: 1,
          couponCode: coupon,
          shippingAddress: print
            ? {
                ...address,
                line2: address.line2?.trim() ? address.line2 : null,
                state: address.state?.trim() ? address.state.trim() : null,
                phone: address.phone?.trim() ? address.phone.trim() : null,
                country,
              }
            : null,
          gift: {
            isGift: gift.isGift,
            message: gift.isGift && gift.message.trim() ? gift.message : null,
          },
          analyticsConsent: choice?.analytics ?? false,
        },
      });
      window.location.assign(checkoutUrl);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('errors.generic'));
      setPaying(false);
    }
  }

  if (!loading && !signedIn) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-6">
        <p className="font-semibold">{t('signInTitle')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('signInText')}</p>
        <div className="mt-4">
          <SignInPanel />
        </div>
      </div>
    );
  }

  const field = 'h-11 w-full rounded-xl border bg-card px-3';

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid content-start gap-8">
        <fieldset>
          <legend className="text-lg font-semibold">{t('formatTitle')}</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {formats.map((option) => (
              <label
                key={option.format}
                className={cn(
                  'flex cursor-pointer flex-col gap-1 rounded-2xl border-2 bg-card p-4 transition has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                  format === option.format
                    ? 'border-primary'
                    : 'border-border hover:border-primary/40',
                )}
              >
                <input
                  type="radio"
                  name="format"
                  value={option.format}
                  checked={format === option.format}
                  onChange={() => {
                    setFormat(option.format);
                  }}
                  className="sr-only"
                />
                <span className="font-semibold">{t(`formats.${option.format}.name`)}</span>
                <span className="text-sm text-muted-foreground">
                  {t(`formats.${option.format}.text`)}
                </span>
                <span className="mt-auto pt-2 font-semibold tabular-nums">
                  {formatPrice(option.amountMinor, offer.currency, locale, country)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {print && (
          <fieldset className="grid gap-3">
            <legend className="mb-1 text-lg font-semibold">{t('addressTitle')}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {ADDRESS_FIELDS.map(({ key, optional, autoComplete }) => (
                <label
                  key={key}
                  className={cn(
                    'grid gap-1.5 text-sm',
                    (key === 'name' || key === 'line1') && 'sm:col-span-2',
                  )}
                >
                  <span className="font-semibold">
                    {t(`address.${key}`)}
                    {optional && (
                      <span className="font-normal text-muted-foreground"> ({t('optional')})</span>
                    )}
                  </span>
                  <input
                    id={`address-${key}`}
                    autoComplete={autoComplete}
                    value={address[key] ?? ''}
                    required={!optional}
                    onChange={(event) => {
                      setAddress((current) => ({ ...current, [key]: event.target.value }));
                    }}
                    className={field}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="grid gap-3">
          <legend className="sr-only">{t('giftTitle')}</legend>
          <label className="flex items-center gap-3 font-semibold">
            <input
              type="checkbox"
              checked={gift.isGift}
              onChange={(event) => {
                setGift((current) => ({ ...current, isGift: event.target.checked }));
              }}
              className="size-4 accent-[var(--primary)]"
            />
            <Gift className="size-4 text-primary" aria-hidden="true" />
            {t('isGift')}
          </label>
          {gift.isGift && (
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">{t('giftMessage')}</span>
              <textarea
                id="gift-message"
                rows={3}
                maxLength={500}
                value={gift.message}
                onChange={(event) => {
                  setGift((current) => ({ ...current, message: event.target.value }));
                }}
                className="w-full rounded-xl border bg-card p-3"
              />
            </label>
          )}
        </fieldset>
      </div>

      <aside className="grid content-start gap-5 self-start rounded-2xl border bg-card p-6 lg:sticky lg:top-24">
        <h2 className="text-xl font-medium">{t('summaryTitle')}</h2>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setCoupon(couponInput.trim() ? couponInput.trim().toUpperCase() : null);
          }}
        >
          <label htmlFor="coupon" className="sr-only">
            {t('coupon')}
          </label>
          <input
            id="coupon"
            placeholder={t('coupon')}
            value={couponInput}
            onChange={(event) => {
              setCouponInput(event.target.value);
            }}
            className="h-10 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm uppercase"
          />
          <Button type="submit" variant="outline" size="sm">
            {t('apply')}
          </Button>
        </form>
        {quote?.couponError && (
          <p role="status" className="text-destructive text-sm">
            {t(`couponErrors.${quote.couponError}`)}
          </p>
        )}
        {quote ? (
          <PriceSummary snapshot={quote.snapshot} country={country} />
        ) : (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t('calculating')}
          </p>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm font-semibold">
            {error}
          </p>
        )}
        <Button size="lg" disabled={!quote || paying} onClick={() => void pay()}>
          {paying ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Lock aria-hidden="true" />
          )}
          {t('pay')}
        </Button>
        <p className="text-xs text-muted-foreground">{t('payNote')}</p>
      </aside>
    </div>
  );
}
