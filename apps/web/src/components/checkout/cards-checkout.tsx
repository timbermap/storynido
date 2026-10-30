'use client';

import {
  ApiError,
  CARD_COPIES,
  CONFIGURED_COUNTRIES,
  addressProblems,
  type Address,
  type CardPiece,
  type CountryCode,
  type Locale,
  type PriceSnapshot,
} from '@storynido/shared';
import { Loader2, Lock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { SignInPanel } from '@/components/auth/sign-in-panel';
import { useAuth } from '@/components/auth/auth-provider';
import { useConsent } from '@/components/consent/consent-provider';
import { Button } from '@/components/ui/button';
import { CountryOptions } from '@/components/country-options';
import { api } from '@/lib/api';

import { PriceSummary } from './price-summary';

type AddressDraft = Omit<Address, 'country' | 'taxId'>;

const EMPTY: AddressDraft = {
  name: '',
  line1: '',
  line2: null,
  city: '',
  state: null,
  postalCode: '',
  phone: null,
};

const FIELDS: { key: keyof AddressDraft; optional?: boolean; autoComplete: string }[] = [
  { key: 'name', autoComplete: 'name' },
  { key: 'line1', autoComplete: 'address-line1' },
  { key: 'line2', optional: true, autoComplete: 'address-line2' },
  { key: 'city', autoComplete: 'address-level2' },
  { key: 'state', autoComplete: 'address-level1' },
  { key: 'postalCode', autoComplete: 'postal-code' },
  { key: 'phone', autoComplete: 'tel' },
];

const PIECES: CardPiece[] = ['invitation', 'thank_you'];
const field = 'h-11 w-full rounded-xl border bg-card px-3';

/**
 * Tarjetas impresas de un kit de Celebraciones (DECISIONS 140): un pedido aparte, con las piezas
 * del kit ya comprado (invitación y agradecimiento), su dirección y su pago.
 */
export function CardsCheckout({
  sourceOrderId,
  country,
}: {
  sourceOrderId: string;
  country: CountryCode;
}) {
  const t = useTranslations('Checkout.kit.printCards');
  const tAddress = useTranslations('Checkout.address');
  const tCheckout = useTranslations('Checkout');
  const locale = useLocale() as Locale;
  const { signedIn, loading } = useAuth();
  const { choice } = useConsent();
  // Piezas que trae el kit (se leen del pedido original) y cuántas copias se quiere de cada una.
  const [available, setAvailable] = useState<CardPiece[] | null>(null);
  const [copies, setCopies] = useState<Partial<Record<CardPiece, number>>>({});
  const [shipTo, setShipTo] = useState<CountryCode>(country);
  const [address, setAddress] = useState<AddressDraft>(EMPTY);
  const [confirmedKey, setConfirmedKey] = useState<string | null>(null);
  const [quote, setQuote] = useState<PriceSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    api('order', { params: { orderId: sourceOrderId } })
      .then((order) => {
        if (cancelled) return;
        const pieces = PIECES.filter((piece) => order.files.includes(piece));
        setAvailable(pieces);
        setCopies(Object.fromEntries(pieces.map((piece) => [piece, 30])));
      })
      .catch(() => {
        if (!cancelled) setAvailable([]);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn, sourceOrderId]);

  const cards = PIECES.flatMap((piece) => {
    const count = copies[piece];
    return count !== undefined && count > 0 ? [{ piece, copies: count }] : [];
  });
  const cardsKey = JSON.stringify(cards);
  const shippingAddress: Address = {
    ...address,
    line2: address.line2?.trim() ? address.line2 : null,
    state: address.state?.trim() ? address.state.trim() : null,
    phone: address.phone?.trim() ? address.phone.trim() : null,
    taxId: null,
    country: shipTo,
  };
  const complete =
    [address.name, address.line1, address.city, address.postalCode].every((v) => v.trim()) &&
    addressProblems(shippingAddress).length === 0;
  const addressKey = complete ? JSON.stringify(shippingAddress) : null;
  const confirmed = addressKey !== null && confirmedKey === addressKey;
  const valid = cards.length > 0 && cards.every((card) => card.copies >= CARD_COPIES.min);

  // El precio lo calcula la API; con la dirección completa, con la imprenta (envío real).
  useEffect(() => {
    if (!signedIn || !valid) return;
    let cancelled = false;
    const timer = setTimeout(
      () => {
        api('cardsQuote', {
          body: {
            sourceOrderId,
            cards: JSON.parse(cardsKey) as typeof cards,
            country: shipTo,
            shippingAddress: addressKey ? (JSON.parse(addressKey) as Address) : null,
            couponCode: null,
            analyticsConsent: false,
          },
        })
          .then((result) => {
            if (cancelled) return;
            setQuote(result.snapshot);
            setError(null);
          })
          .catch((caught: unknown) => {
            if (!cancelled) setError(caught instanceof ApiError ? caught.message : t('error'));
          });
      },
      addressKey ? 600 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `cards` va serializado en cardsKey.
  }, [signedIn, valid, sourceOrderId, cardsKey, shipTo, addressKey, t]);

  async function pay() {
    setPaying(true);
    setError(null);
    try {
      const { checkoutUrl } = await api('createCards', {
        body: {
          sourceOrderId,
          cards,
          country: shipTo,
          shippingAddress,
          couponCode: null,
          analyticsConsent: choice?.analytics ?? false,
        },
      });
      window.location.assign(checkoutUrl);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('error'));
      setPaying(false);
    }
  }

  if (!loading && !signedIn) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-6">
        <p className="font-semibold">{tCheckout('signInTitle')}</p>
        <div className="mt-4">
          <SignInPanel />
        </div>
      </div>
    );
  }
  if (available === null) {
    return (
      <p role="status" className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {tCheckout('calculating')}
      </p>
    );
  }
  if (available.length === 0) {
    return <p className="rounded-2xl border bg-card p-6">{t('noPieces')}</p>;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid content-start gap-8">
        <fieldset className="grid gap-3">
          <legend className="mb-1 text-lg font-semibold">{t('piecesTitle')}</legend>
          <p className="text-sm text-muted-foreground">{t('piecesText')}</p>
          {available.map((piece) => (
            <label key={piece} className="grid gap-1.5 text-sm sm:max-w-xs">
              <span className="font-semibold">{t(`pieces.${piece}`)}</span>
              <input
                id={`cards-${piece}`}
                type="number"
                min={0}
                max={CARD_COPIES.max}
                value={copies[piece] ?? 0}
                onChange={(event) => {
                  const next = Math.min(
                    CARD_COPIES.max,
                    Math.max(0, Math.floor(Number(event.target.value)) || 0),
                  );
                  setCopies((current) => ({ ...current, [piece]: next }));
                }}
                className={field}
              />
            </label>
          ))}
          <p className="text-sm text-muted-foreground">{t('minimum', { min: CARD_COPIES.min })}</p>
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="mb-1 text-lg font-semibold">{tCheckout('addressTitle')}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm sm:col-span-2">
              <span className="font-semibold">{tAddress('country')}</span>
              <select
                id="address-country"
                autoComplete="country"
                value={shipTo}
                onChange={(event) => {
                  setShipTo(event.target.value as CountryCode);
                }}
                className={field}
              >
                <CountryOptions locale={locale} current={shipTo} />
              </select>
            </label>
            {FIELDS.map(({ key, optional, autoComplete }) => (
              <label
                key={key}
                className={
                  key === 'name' || key === 'line1'
                    ? 'grid gap-1.5 text-sm sm:col-span-2'
                    : 'grid gap-1.5 text-sm'
                }
              >
                <span className="font-semibold">
                  {tAddress(key)}
                  {optional && (
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      ({tCheckout('optional')})
                    </span>
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
          {!CONFIGURED_COUNTRIES.includes(shipTo) && (
            <p className="text-sm text-muted-foreground">{tCheckout('importDuties')}</p>
          )}
          {addressKey && (
            <label className="flex items-start gap-3 rounded-xl border bg-card p-3 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => {
                  setConfirmedKey(event.target.checked ? addressKey : null);
                }}
                className="mt-0.5 size-4 accent-[var(--primary)]"
              />
              <span>
                <span className="font-semibold">{tAddress('confirm')}</span>
                <span className="mt-1 block text-muted-foreground">
                  {[address.name, address.line1, address.city, address.postalCode, shipTo].join(
                    ', ',
                  )}
                </span>
              </span>
            </label>
          )}
        </fieldset>
      </div>

      <aside className="grid content-start gap-5 self-start rounded-2xl border bg-card p-6 lg:sticky lg:top-24">
        <h2 className="text-xl font-medium">{tCheckout('summaryTitle')}</h2>
        {quote ? (
          <PriceSummary snapshot={quote} country={country} />
        ) : (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {tCheckout('calculating')}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        )}
        {quote?.shipping.pending && (
          <p role="status" className="text-sm text-muted-foreground">
            {tCheckout('addressToQuote')}
          </p>
        )}
        <Button
          size="lg"
          disabled={!quote || !valid || paying || quote.shipping.pending || !confirmed}
          onClick={() => void pay()}
        >
          {paying ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Lock aria-hidden="true" />
          )}
          {tCheckout('pay')}
        </Button>
      </aside>
    </div>
  );
}
