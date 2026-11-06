'use client';

import {
  ApiError,
  CONFIGURED_COUNTRIES,
  POSTAL_CODE_EXAMPLES,
  STATE_REQUIRED_COUNTRIES,
  TAX_ID_COUNTRIES,
  TAX_ID_REQUIRED_COUNTRIES,
  addressProblems,
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

import { trackConversion } from '@/lib/conversions';

import { SignInPanel } from '@/components/auth/sign-in-panel';
import { useAuth } from '@/components/auth/auth-provider';
import { useConsent } from '@/components/consent/consent-provider';
import { useProStatus } from '@/components/pro/use-pro-status';
import { Button, buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { CountryOptions } from '@/components/country-options';
import { formatPrice } from '@/lib/format';
import { reorderStart } from '@/lib/reorder';
import { cn } from '@/lib/utils';
import { CheckoutBook } from './checkout-book';

import { ChristmasNote, GiftDeadline } from './gift-deadline';
import { PriceSummary } from './price-summary';

type AddressDraft = Omit<Address, 'country'>;

/** Dirección lista para cotizar: lo obligatorio cargado y las reglas de su país cumplidas. */
function addressComplete(address: Address): boolean {
  const required = [address.name, address.line1, address.city, address.postalCode];
  return required.every((value) => value.trim()) && addressProblems(address).length === 0;
}

const EMPTY_ADDRESS: AddressDraft = {
  name: '',
  line1: '',
  line2: null,
  city: '',
  state: null,
  postalCode: '',
  phone: null,
  taxId: null,
};

const STATE_REQUIRED: readonly string[] = STATE_REQUIRED_COUNTRIES;
const TAX_ID_REQUIRED: readonly string[] = TAX_ID_REQUIRED_COUNTRIES;

/** Campos que, cargados con un valor que no cumple la regla del país, muestran el motivo. */
const EXPLAINED: readonly (keyof AddressDraft)[] = ['postalCode', 'phone', 'taxId', 'state'];

const ADDRESS_FIELDS: { key: keyof AddressDraft; optional?: boolean; autoComplete: string }[] = [
  { key: 'name', autoComplete: 'name' },
  { key: 'line1', autoComplete: 'address-line1' },
  { key: 'line2', optional: true, autoComplete: 'address-line2' },
  { key: 'city', autoComplete: 'address-level2' },
  { key: 'state', autoComplete: 'address-level1' },
  { key: 'postalCode', autoComplete: 'postal-code' },
  { key: 'phone', autoComplete: 'tel' },
  { key: 'taxId', optional: true, autoComplete: 'off' },
];

/**
 * Checkout: formato, dirección (si es impreso), regalo y cupón. El precio lo calcula siempre
 * la API; acá solo se muestra. Pagar crea el pedido y lleva al procesador de pagos.
 */
export function Checkout({
  bookId,
  offer,
  country,
  reorderOf = null,
}: {
  bookId: string;
  offer: Offer;
  country: CountryCode;
  /**
   * Otra copia: el pedido cuyo libro ya generado se vuelve a pedir (sin IA). Solo impresa: el PDF
   * ya lo tiene y se descarga gratis desde Mis cuentos.
   */
  reorderOf?: string | null;
}) {
  const t = useTranslations('Checkout');
  const locale = useLocale() as Locale;
  const { signedIn, loading } = useAuth();
  const { choice } = useConsent();
  const { status: pro } = useProStatus();
  const tPro = useTranslations('Pro.account');
  const stateLabel = (code: string) =>
    t.has(`address.stateByCountry.${code}`)
      ? t(`address.stateByCountry.${code}`)
      : t('address.stateOther');
  // Impresos del país, del más barato al más caro (la otra copia arranca en el que compró).
  const printOptions = offer.formats
    .filter((option) => option.format !== 'digital')
    .sort((a, b) => a.amountMinor - b.amountMinor);
  const [chosenFormat, setFormat] = useState<BookFormat>(
    (reorderOf ? printOptions[0]?.format : offer.formats[0]?.format) ?? 'digital',
  );
  // Otra copia: el pedido original dice qué formato compró y si el libro se puede imprimir
  // (uno creado en digital tiene ilustraciones de pantalla). Hasta saberlo no se cotiza.
  const [source, setSource] = useState<'loading' | 'ready' | 'digital_only'>(
    reorderOf ? 'loading' : 'ready',
  );
  const [address, setAddress] = useState<AddressDraft>(EMPTY_ADDRESS);
  const [gift, setGift] = useState({ isGift: false, message: '' });
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<string | null>(null);
  const [quote, setQuote] = useState<{
    snapshot: PriceSnapshot;
    couponError: string | null;
    availableFormats?: BookFormat[];
  } | null>(null);
  // Solo los formatos que este libro admite (un cuento corto no se imprime como fotolibro).
  const available = quote?.availableFormats;
  const formats = offer.formats.filter(
    (option) =>
      (!reorderOf || option.format !== 'digital') &&
      (!available || available.includes(option.format)),
  );
  // Si el formato elegido no lo admite este libro, vuelve al digital (en otra copia, al impreso
  // más barato que admita).
  const fallback = reorderOf
    ? ([...formats].sort((a, b) => a.amountMinor - b.amountMinor)[0]?.format ?? chosenFormat)
    : 'digital';
  const format = available && !available.includes(chosenFormat) ? fallback : chosenFormat;
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  // Pago iniciado: la primera vez que hay precio para este libro (una sola vez, sin pasos nuevos).
  const quotedTotal = quote?.snapshot.totalMinor;
  const quotedCurrency = quote?.snapshot.currency;
  useEffect(() => {
    if (quotedTotal === undefined || !quotedCurrency) return;
    trackConversion(`begin:${bookId}`, {
      name: 'begin_checkout',
      value: quotedTotal / 100,
      currency: quotedCurrency,
    });
  }, [bookId, quotedTotal, quotedCurrency]);
  // Impreso: quien paga confirma que el domicilio de entrega es correcto.
  // Si cambia la dirección, hay que volver a confirmarla.
  const [copies, setCopies] = useState(1);
  const [confirmedKey, setConfirmedKey] = useState<string | null>(null);
  // Envío estimado al país elegido, antes de cargar la dirección (el exacto sale con ella).
  const [estimate, setEstimate] = useState<{
    shippingUsdMinor: number;
    etaDaysMin: number;
    etaDaysMax: number;
  } | null>(null);
  // País de envío del impreso (cualquiera: la imprenta se cotiza con la dirección).
  const [shipTo, setShipTo] = useState<CountryCode>(country);
  const print = format !== 'digital';
  // Ejemplares: solo el cuento grapado (ideal para souvenirs); lo demás es de a uno.
  const quantity = format === 'booklet' ? copies : 1;
  // El pedido es del país de la dirección: define la moneda y las imprentas.
  const orderCountry = print ? shipTo : country;
  const shippingAddress: Address | null = print
    ? {
        ...address,
        line2: address.line2?.trim() ? address.line2 : null,
        state: address.state?.trim() ? address.state.trim() : null,
        phone: address.phone?.trim() ? address.phone.trim() : null,
        taxId:
          (TAX_ID_COUNTRIES as readonly string[]).includes(shipTo) && address.taxId?.trim()
            ? address.taxId.trim()
            : null,
        country: shipTo,
      }
    : null;
  // Con la dirección completa se cotiza con las imprentas (envío real).
  const addressKey =
    shippingAddress && addressComplete(shippingAddress) ? JSON.stringify(shippingAddress) : null;
  const problems = shippingAddress ? addressProblems(shippingAddress) : [];
  const confirmed = addressKey !== null && confirmedKey === addressKey;

  useEffect(() => {
    if (format === 'digital') return;
    let cancelled = false;
    void api('catalogShippingEstimate', { query: { country: shipTo, format } })
      .then((result) => {
        if (!cancelled) setEstimate(result.estimate);
      })
      .catch(() => {
        if (!cancelled) setEstimate(null);
      });
    return () => {
      cancelled = true;
      setEstimate(null);
    };
  }, [format, shipTo]);

  useEffect(() => {
    if (!reorderOf || !signedIn) return;
    let cancelled = false;
    void api('order', { params: { orderId: reorderOf } })
      .then((order) => {
        if (cancelled) return;
        const start = reorderStart(order.items, offer.formats);
        if (start.kind === 'digital_only') {
          setSource('digital_only');
          return;
        }
        if (start.kind === 'print') setFormat(start.format);
        setSource('ready');
      })
      .catch(() => {
        // Sin el pedido se cotiza igual: la API decide si se puede imprimir.
        if (!cancelled) setSource('ready');
      });
    return () => {
      cancelled = true;
    };
  }, [reorderOf, signedIn, offer]);

  // El resumen se recalcula en el servidor cada vez que cambia el formato, el cupón o la
  // dirección (con una pausa, para no cotizar con cada tecla).
  useEffect(() => {
    if (!signedIn || source !== 'ready') return;
    let cancelled = false;
    const timer = setTimeout(
      () => {
        api('checkoutQuote', {
          body: {
            bookId,
            format,
            country: orderCountry,
            quantity,
            couponCode: coupon,
            sourceOrderId: reorderOf,
            shippingAddress: addressKey ? (JSON.parse(addressKey) as Address) : null,
          },
        })
          .then((result) => {
            if (cancelled) return;
            setQuote(result);
            setError(null);
          })
          .catch((caught: unknown) => {
            if (cancelled) return;
            // Un libro creado en digital no se reimprime (el resumen no queda «Calculando…»).
            if (reorderOf && caught instanceof ApiError && caught.code === 'print_unavailable') {
              setSource('digital_only');
              return;
            }
            setError(caught instanceof ApiError ? caught.message : t('errors.generic'));
          });
      },
      addressKey ? 600 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bookId, format, quantity, orderCountry, coupon, reorderOf, signedIn, source, addressKey, t]);

  async function pay() {
    setPaying(true);
    setError(null);
    try {
      const body = {
        format,
        country: orderCountry,
        quantity,
        couponCode: coupon,
        shippingAddress,
        gift: {
          isGift: gift.isGift,
          message: gift.isGift && gift.message.trim() ? gift.message : null,
        },
        analyticsConsent: choice?.analytics ?? false,
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

  // Otra copia que no se puede imprimir (creado en digital, o sin imprenta en el país): no se
  // paga nada; el PDF se descarga gratis desde Mis cuentos.
  if (reorderOf && (source === 'digital_only' || printOptions.length === 0)) {
    const key = source === 'digital_only' ? 'reorderDigitalOnly' : 'reorderNoPrint';
    return (
      <div role="status" className="mx-auto max-w-md rounded-2xl border bg-card p-6">
        <p className="font-semibold">{t(`${key}.title`)}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t(`${key}.text`)}</p>
        <Link
          href={{ pathname: '/my-stories', query: { estado: 'terminados' } }}
          className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}
        >
          {t('reorderBack')}
        </Link>
      </div>
    );
  }

  const field = 'h-11 w-full rounded-xl border bg-card px-3';
  // Las tarjetas dicen «desde»: el ebook cuesta según la extensión del libro (el más corto, como
  // en las landings) y el impreso suma el envío. El precio exacto es el del resumen.
  const lengthMinors = offer.lengthPrices.map((item) => item.amountMinor);
  const fromMinor = (option: Offer['formats'][number]) =>
    option.format === 'digital' && lengthMinors.length > 0
      ? Math.min(...lengthMinors)
      : option.amountMinor;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {reorderOf === null && <CheckoutBook bookId={bookId} />}
      <div className="grid content-start gap-8">
        <fieldset>
          <legend className="text-lg font-semibold">{t('formatTitle')}</legend>
          <div className="mt-3 grid gap-5">
            {[
              { key: 'ebook', options: formats.filter((option) => option.format === 'digital') },
              { key: 'print', options: formats.filter((option) => option.format !== 'digital') },
            ]
              .filter((group) => group.options.length > 0)
              .map((group) => (
                <div key={group.key} className="grid gap-2">
                  <p className="text-sm font-semibold text-muted-foreground">
                    {t(`formatGroups.${group.key}`)}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {group.options.map((option) => (
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
                          {t('fromPrice', {
                            price: formatPrice(fromMinor(option), offer.currency, locale, country),
                          })}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </fieldset>

        {format === 'booklet' && (
          <label className="grid max-w-xs gap-1.5 text-sm">
            <span className="font-semibold">{t('copies.label')}</span>
            <input
              id="copies"
              type="number"
              min={1}
              max={200}
              value={copies}
              onChange={(event) => {
                setCopies(Math.min(200, Math.max(1, Math.floor(Number(event.target.value)) || 1)));
              }}
              className={field}
            />
            <span className="text-muted-foreground">{t('copies.hint')}</span>
          </label>
        )}

        {print && (
          <fieldset className="grid gap-3">
            <legend className="mb-1 text-lg font-semibold">{t('addressTitle')}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm sm:col-span-2">
                <span className="font-semibold">{t('address.country')}</span>
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
              {ADDRESS_FIELDS.filter(
                ({ key }) =>
                  key !== 'taxId' || (TAX_ID_COUNTRIES as readonly string[]).includes(shipTo),
              ).map(({ key, optional: alwaysOptional, autoComplete }) => {
                // El estado solo es obligatorio donde las imprentas lo exigen (México, EE. UU.,
                // Brasil y Chile); en otros países se llama provincia o departamento, o no existe.
                // El documento es obligatorio donde la aduana lo pide para entregar.
                const optional =
                  key === 'taxId'
                    ? !TAX_ID_REQUIRED.includes(shipTo)
                    : (alwaysOptional ?? false) ||
                      (key === 'state' && !STATE_REQUIRED.includes(shipTo));
                const value = address[key] ?? '';
                const invalid =
                  EXPLAINED.includes(key) && value.trim() !== '' && problems.includes(key);
                return (
                  <label
                    key={key}
                    className={cn(
                      'grid gap-1.5 text-sm',
                      (key === 'name' || key === 'line1') && 'sm:col-span-2',
                    )}
                  >
                    <span className="font-semibold">
                      {key === 'taxId'
                        ? t(`address.taxId.${shipTo}`)
                        : key === 'state'
                          ? stateLabel(shipTo)
                          : key === 'line2'
                            ? t(shipTo === 'MX' ? 'address.line2' : 'address.line2Other')
                            : t(`address.${key}`)}
                      {optional && (
                        <span className="font-normal text-muted-foreground">
                          {' '}
                          ({t('optional')})
                        </span>
                      )}
                    </span>
                    <input
                      id={`address-${key}`}
                      autoComplete={autoComplete}
                      value={value}
                      required={!optional}
                      aria-invalid={invalid || undefined}
                      aria-describedby={invalid ? `address-${key}-error` : undefined}
                      onChange={(event) => {
                        setAddress((current) => ({ ...current, [key]: event.target.value }));
                      }}
                      className={field}
                    />
                    {invalid && (
                      <span id={`address-${key}-error`} className="text-xs text-destructive">
                        {key === 'postalCode' && POSTAL_CODE_EXAMPLES[shipTo]
                          ? t('address.errors.postalCodeExample', {
                              example: POSTAL_CODE_EXAMPLES[shipTo],
                            })
                          : t(`address.errors.${key}`)}
                      </span>
                    )}
                    {key === 'taxId' && !invalid && (
                      <span className="text-xs text-muted-foreground">
                        {t(optional ? 'address.taxIdHintOptional' : 'address.taxIdHint')}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            {!CONFIGURED_COUNTRIES.includes(shipTo) && (
              <p className="text-sm text-muted-foreground">{t('importDuties')}</p>
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
                  <span className="font-semibold">{t('address.confirm')}</span>
                  <span className="mt-1 block text-muted-foreground">
                    {[address.line1, address.city, address.state, address.postalCode, shipTo]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </span>
              </label>
            )}
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
          {print && quote && quote.snapshot.shipping.minor > 0 && (
            <ChristmasNote
              etaDaysMin={quote.snapshot.shipping.etaDaysMin}
              etaDaysMax={quote.snapshot.shipping.etaDaysMax}
            />
          )}
          {gift.isGift && print && quote && quote.snapshot.shipping.minor > 0 && (
            <GiftDeadline
              etaDaysMin={quote.snapshot.shipping.etaDaysMin}
              etaDaysMax={quote.snapshot.shipping.etaDaysMax}
            />
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
          <p role="status" className="text-sm text-destructive">
            {t(`couponErrors.${quote.couponError}`)}
          </p>
        )}
        {quote ? (
          <>
            <PriceSummary snapshot={quote.snapshot} country={country} local={offer.local} />
            {print && quote.snapshot.shipping.pending && estimate && (
              <p className="rounded-xl bg-peach/60 px-4 py-3 text-sm font-semibold text-navy">
                {t('shippingEstimate', {
                  price: formatPrice(estimate.shippingUsdMinor, 'USD', locale, country),
                  total: formatPrice(
                    quote.snapshot.totalMinor + estimate.shippingUsdMinor,
                    'USD',
                    locale,
                    country,
                  ),
                  min: estimate.etaDaysMin,
                  max: estimate.etaDaysMax,
                })}
              </p>
            )}
            {/* Profesionales: descuento por volumen (sin suscripción); cuánto falta para el próximo. */}
            {pro?.accountType === 'professional' && pro.discount?.next && (
              <p className="text-sm text-muted-foreground">
                {tPro('next', {
                  missing: pro.discount.next.purchases - pro.discount.purchases,
                  percent: pro.discount.next.percent,
                })}
              </p>
            )}
          </>
        ) : (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t('calculating')}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        )}
        {print && quote?.snapshot.shipping.pending && (
          <p role="status" className="text-sm text-muted-foreground">
            {t('addressToQuote')}
          </p>
        )}
        <Button
          size="lg"
          disabled={!quote || paying || (print && (quote.snapshot.shipping.pending || !confirmed))}
          onClick={() => void pay()}
        >
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
