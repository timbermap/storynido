'use client';

import {
  ApiError,
  KIT_LIMITS,
  KIT_PIECES,
  REQUIRED_KIT_PIECES,
  type CountryCode,
  type KitPiece,
  type Locale,
  type PriceSnapshot,
} from '@storynido/shared';
import { Loader2, Lock, Printer } from 'lucide-react';
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

type Pricing = NonNullable<Awaited<ReturnType<typeof api<'catalogEventPricing'>>>['pricing']>;

const field = 'h-11 w-full rounded-xl border bg-card px-3';

/**
 * Checkout de Eventos: un diseño y las piezas del kit para imprimir (con la licencia de
 * copias). El precio lo calcula la API. El impreso de las piezas se pide por cotización.
 */
export function KitCheckout({
  bookId,
  country,
  reorderOf = null,
}: {
  bookId: string;
  country: CountryCode;
  /** "Pedir más copias" del mismo diseño (no se cobra el diseño otra vez). */
  reorderOf?: string | null;
}) {
  const t = useTranslations('Checkout');
  const tKit = useTranslations('Checkout.kit');
  const locale = useLocale() as Locale;
  const { signedIn, loading } = useAuth();
  const { choice } = useConsent();
  const [pricing, setPricing] = useState<Pricing | null | undefined>(undefined);
  const [pieces, setPieces] = useState<Set<KitPiece>>(new Set(['mini_book', 'invitation']));
  const [copies, setCopies] = useState(20);
  const [time, setTime] = useState('');
  const [place, setPlace] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<string | null>(null);
  const [quote, setQuote] = useState<{
    snapshot: PriceSnapshot;
    couponError: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [printMessage, setPrintMessage] = useState('');
  const [printSent, setPrintSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api('catalogEventPricing', { query: { country } })
      .then((result) => {
        if (cancelled) return;
        setPricing(result.pricing);
        // Solo las piezas que se venden en el país.
        if (result.pricing) {
          const sold = result.pricing.pieces;
          setPieces(
            (current) =>
              new Set([...current].filter((piece) => piece === 'mini_book' || piece in sold)),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setPricing(null);
      });
    return () => {
      cancelled = true;
    };
  }, [country]);

  const kit = {
    pieces: KIT_PIECES.filter((piece) => pieces.has(piece)).map((piece) => ({
      piece,
      copies: Math.min(Math.max(1, copies || 1), KIT_LIMITS.maxCopies),
    })),
    invitation: pieces.has('invitation')
      ? { time: time.trim() || null, place: place.trim() || null }
      : null,
  };
  const kitKey = JSON.stringify(kit);

  useEffect(() => {
    if (!signedIn || !pricing) return;
    let cancelled = false;
    api('checkoutQuote', {
      body: {
        bookId,
        format: 'digital',
        country,
        quantity: 1,
        couponCode: coupon,
        sourceOrderId: reorderOf,
        kit: JSON.parse(kitKey) as typeof kit,
      },
    })
      .then((result) => {
        if (cancelled) return;
        setQuote(result);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : t('errors.generic'));
      });
    return () => {
      cancelled = true;
    };
    // `kit` se compara por su contenido (kitKey).
  }, [bookId, country, coupon, reorderOf, kitKey, signedIn, pricing, t]);

  async function pay() {
    setPaying(true);
    setError(null);
    try {
      const body = {
        format: 'digital' as const,
        country,
        quantity: 1,
        couponCode: coupon,
        shippingAddress: null,
        gift: { isGift: false, message: null },
        analyticsConsent: choice?.analytics ?? false,
        kit,
      };
      const { checkoutUrl } = reorderOf
        ? await api('reorder', { params: { orderId: reorderOf }, body })
        : await api('createCheckout', { body: { ...body, bookId } });
      window.location.assign(checkoutUrl);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('errors.generic'));
      setPaying(false);
    }
  }

  async function requestPrint() {
    setError(null);
    try {
      await api('eventPrintQuote', {
        body: {
          bookId,
          country,
          pieces: kit.pieces.map((item) => item.piece),
          copies: kit.pieces[0]?.copies ?? copies,
          message: printMessage.trim() || null,
        },
      });
      setPrintSent(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('errors.generic'));
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
  if (pricing === null) {
    return <p className="rounded-2xl border bg-card p-6">{tKit('unavailable')}</p>;
  }

  const money = (minor: number) =>
    pricing ? formatPrice(minor, pricing.currency, locale, country) : '';
  const sold = (piece: KitPiece) =>
    piece === 'mini_book' || Boolean(pricing && piece in pricing.pieces);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid content-start gap-8">
        <fieldset>
          <legend className="text-lg font-semibold">{tKit('piecesTitle')}</legend>
          <p className="mt-1 text-sm text-muted-foreground">{tKit('piecesNote')}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {KIT_PIECES.filter(sold).map((piece) => {
              const required = REQUIRED_KIT_PIECES.includes(piece);
              const price = piece === 'mini_book' ? null : pricing?.pieces[piece];
              return (
                <label
                  key={piece}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-2xl border-2 bg-card p-4 transition has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                    pieces.has(piece) ? 'border-primary' : 'border-border hover:border-primary/40',
                    required && 'cursor-default',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={pieces.has(piece)}
                    disabled={required}
                    onChange={(event) => {
                      setPieces((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(piece);
                        else next.delete(piece);
                        return next;
                      });
                    }}
                    className="mt-1 size-4 accent-[var(--primary)]"
                  />
                  <span className="grid gap-1">
                    <span className="font-semibold">{tKit(`pieces.${piece}.name`)}</span>
                    <span className="text-sm text-muted-foreground">
                      {tKit(`pieces.${piece}.text`)}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {required
                        ? reorderOf
                          ? tKit('includedAgain')
                          : `${tKit('design')} ${pricing ? money(pricing.designMinor) : ''}`
                        : price !== undefined && price !== null
                          ? `+ ${money(price)}`
                          : ''}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <label className="grid max-w-xs gap-1.5 text-sm">
          <span className="font-semibold">{tKit('copies')}</span>
          <input
            id="kit-copies"
            type="number"
            min={1}
            max={KIT_LIMITS.maxCopies}
            value={copies}
            onChange={(event) => {
              setCopies(Number(event.target.value));
            }}
            className={field}
          />
          <span className="text-muted-foreground">{tKit('copiesNote')}</span>
        </label>

        {pieces.has('invitation') && (
          <fieldset className="grid gap-3">
            <legend className="mb-1 text-lg font-semibold">{tKit('invitationTitle')}</legend>
            <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">{tKit('time')}</span>
                <input
                  id="kit-time"
                  value={time}
                  maxLength={KIT_LIMITS.timeMaxLength}
                  placeholder="16:00"
                  onChange={(event) => {
                    setTime(event.target.value);
                  }}
                  className={field}
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">{tKit('place')}</span>
                <input
                  id="kit-place"
                  value={place}
                  maxLength={KIT_LIMITS.placeMaxLength}
                  onChange={(event) => {
                    setPlace(event.target.value);
                  }}
                  className={field}
                />
              </label>
            </div>
            <p className="text-sm text-muted-foreground">{tKit('invitationNote')}</p>
          </fieldset>
        )}

        <details className="rounded-2xl border bg-card p-4">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold">
            <Printer className="size-4 text-primary" aria-hidden="true" />
            {tKit('printTitle')}
          </summary>
          {printSent ? (
            <p role="status" className="mt-3 text-sm font-semibold text-success">
              {tKit('printSent')}
            </p>
          ) : (
            <div className="mt-3 grid gap-3 text-sm">
              <p className="text-muted-foreground">{tKit('printText')}</p>
              <textarea
                id="kit-print-message"
                rows={3}
                maxLength={1000}
                value={printMessage}
                placeholder={tKit('printPlaceholder')}
                onChange={(event) => {
                  setPrintMessage(event.target.value);
                }}
                className="w-full rounded-xl border bg-background p-3"
              />
              <Button
                variant="outline"
                size="sm"
                className="justify-self-start"
                onClick={() => void requestPrint()}
              >
                {tKit('printRequest')}
              </Button>
            </div>
          )}
        </details>
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
          <label htmlFor="kit-coupon" className="sr-only">
            {t('coupon')}
          </label>
          <input
            id="kit-coupon"
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
          <p role="status" className="text-sm text-destructive">
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
        <p className="text-xs text-muted-foreground">
          {tKit('license', { copies: kit.pieces[0]?.copies ?? copies })}
        </p>
        {error && (
          <p role="alert" className="text-sm font-semibold text-destructive">
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
