'use client';

import { ApiError, type BookFormat, type CountryCode, type PublicOrder } from '@storynido/shared';
import {
  BookHeart,
  BookOpen,
  CircleCheck,
  Download,
  FlaskConical,
  LifeBuoy,
  Loader2,
  Printer,
  RotateCcw,
  Sparkles,
  Truck,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import {
  GENERATED_STATUSES,
  OrderTimeline,
  SETTLED_STATUSES,
  isPrintOrder,
} from '@/components/orders/timeline';
import { Button, buttonVariants } from '@/components/ui/button';
import { OrderHeader } from '@/components/orders/order-header';
import { BookProgressView } from '@/components/orders/book-progress';
import { OrderReview } from '@/components/orders/order-review';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { trackConversion } from '@/lib/conversions';

import { AwaitingPayment } from './awaiting-payment';
import { PriceSummary } from './price-summary';

/** «Imprimir tarjetas» del kit: apagado por defecto (NEXT_PUBLIC_KIT_PRINT_CARDS=true lo prende). */
const KIT_PRINT_CARDS = process.env.NEXT_PUBLIC_KIT_PRINT_CARDS === 'true';

/** Estados en los que todavía no hay una compra pagada. */
const UNPAID = new Set(['draft', 'preview_ready', 'pending_payment', 'cancelled', 'refunded']);

/** Mientras el libro está en la imprenta los cambios llegan en días: se consulta más espaciado. */
const AT_PRINTER = new Set(['sent_to_print', 'in_production', 'shipped']);

/** Estado del pedido, en vivo: se consulta cada pocos segundos hasta que se resuelve. */
export function OrderStatus({ orderId, country }: { orderId: string; country: CountryCode }) {
  const t = useTranslations('Checkout.order');
  const locale = useLocale();
  const { signedIn, loading } = useAuth();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // «Ya pagué»: vuelve a consultar en el momento (reinicia la consulta periódica).
  const [checkNow, setCheckNow] = useState(0);
  const tKit = useTranslations('Checkout.kit');
  // Compra: cuando el pedido ya está pagado (una sola vez por pedido).
  const paidOrder = order && !UNPAID.has(order.status) ? order : null;
  useEffect(() => {
    if (!paidOrder?.priceSnapshot) return;
    trackConversion(`purchase:${paidOrder.orderId}`, {
      name: 'purchase',
      value: paidOrder.priceSnapshot.totalMinor / 100,
      currency: paidOrder.priceSnapshot.currency,
      transactionId: paidOrder.orderId,
    });
  }, [paidOrder]);

  useEffect(() => {
    if (!signedIn) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const current = await api('order', { params: { orderId } });
        if (cancelled) return;
        setOrder(current);
        const print = isPrintOrder(current.items);
        const done = SETTLED_STATUSES.has(current.status) || (!print && current.status === 'ready');
        if (!done) {
          timer = setTimeout(() => void load(), AT_PRINTER.has(current.status) ? 30_000 : 4000);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : t('error'));
      }
    };
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderId, signedIn, t, checkNow]);

  async function run(kind: 'payment' | 'print' | 'download', file = 'book') {
    setBusy(kind === 'download' ? `download:${file}` : kind);
    setError(null);
    try {
      if (kind === 'payment') {
        setOrder(await api('devSimulatePayment', { params: { orderId } }));
      } else if (kind === 'print') {
        await api('devSimulatePrint', { params: { orderId } });
        setOrder(await api('order', { params: { orderId } }));
      } else {
        const { url } = await api('orderDownload', {
          params: { orderId },
          query: { file: file as 'book' },
        });
        window.location.assign(url);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('error'));
    } finally {
      setBusy(null);
    }
  }

  if (loading || (!order && !error)) {
    return (
      <p role="status" className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {t('loading')}
      </p>
    );
  }
  if (!order) {
    return (
      <p role="alert" className="font-semibold text-destructive">
        {error}
      </p>
    );
  }

  const print = isPrintOrder(order.items);
  // Eventos: el kit con sus piezas, para descargar de a una o todo junto.
  const kitFiles = order.files.filter((file) => file !== 'book' && file !== 'kit_zip');
  const isKit = order.files.includes('kit_zip');
  // Pedido aparte de tarjetas impresas: no hay descarga ni recompra, solo el seguimiento.
  const isCards = order.items.every((item) => item.format === 'card');
  const cardPieces = kitFiles.filter((file) => file === 'invitation' || file === 'thank_you');
  // El kit dice sus piezas en el resumen: el formato solo se nombra para un libro.
  const bookItem = order.items.find(
    (item): item is { format: BookFormat; quantity: number } => item.format !== 'card',
  );
  const format = isKit ? null : (bookItem?.format ?? null);
  // Leer online (DECISIONS 254): el mismo visor de Mis cuentos → Terminados, cuando el pedido ya
  // tiene el PDF limpio del libro (ebook, impreso o el librito del kit). Las tarjetas no.
  const readable = order.canDownload && order.files.includes('book') && !isCards;
  const readHref = {
    pathname: '/my-stories/read/[orderId]',
    params: { orderId: order.orderId },
    query: { desde: 'pedido' },
  } as const;
  // Ya lo tiene (digital listo o impreso entregado): el libro pasa a ser lo principal y los
  // pasos, todos hechos, ya no suman (DECISIONS 274).
  const finished = order.status === 'delivered' || (!print && order.status === 'ready');
  const statusText =
    isKit && order.status === 'ready' ? tKit('ready') : t(`status.${order.status}`);
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
      <div className="grid content-start gap-6">
        <OrderHeader
          orderId={order.orderId}
          bookId={order.bookId}
          format={format}
          large={finished}
        />
        {finished ? (
          <p
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 text-xl font-medium"
          >
            <CircleCheck className="size-6 shrink-0 text-success" aria-hidden="true" />
            {statusText}
          </p>
        ) : (
          <>
            <p role="status" aria-live="polite" className="text-xl font-medium">
              {statusText}
            </p>
            <OrderTimeline status={order.status} print={print} />
          </>
        )}
        {order.status === 'pending_payment' && !order.canSimulatePayment && (
          <AwaitingPayment
            orderId={order.orderId}
            onCheck={() => {
              setCheckNow((count) => count + 1);
            }}
          />
        )}
        {order.progress && <BookProgressView progress={order.progress} />}

        {(order.canDownload ||
          Boolean(order.tracking?.url) ||
          GENERATED_STATUSES.has(order.status)) && (
          <div className="flex flex-wrap gap-3">
            {order.canDownload && isKit && (
              <Button disabled={busy !== null} onClick={() => void run('download', 'kit_zip')}>
                {busy === 'download:kit_zip' ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Download aria-hidden="true" />
                )}
                {tKit('downloadAll')}
              </Button>
            )}
            {/* Un libro: leer es lo principal y la descarga queda al lado. En el kit lo principal
                sigue siendo bajar todo; el librito se lee al lado. */}
            {readable && !isKit && (
              <Link href={readHref} data-track="leer" className={buttonVariants()}>
                <BookOpen aria-hidden="true" />
                {t('read')}
              </Link>
            )}
            {order.canDownload && !isKit && !isCards && (
              <Button
                variant={readable ? 'outline' : 'default'}
                disabled={busy !== null}
                onClick={() => void run('download')}
              >
                {busy === 'download:book' ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Download aria-hidden="true" />
                )}
                {t('download')}
              </Button>
            )}
            {readable && isKit && (
              <Link
                href={readHref}
                data-track="leer"
                className={buttonVariants({ variant: 'outline' })}
              >
                <BookOpen aria-hidden="true" />
                {t('read')}
              </Link>
            )}
            {order.tracking?.url && (
              <a
                href={order.tracking.url}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: 'outline' })}
              >
                <Truck aria-hidden="true" />
                {t('track')}
              </a>
            )}
            {/* Otra copia solo de un libro impreso (el PDF ya lo tiene): un ebook se creó con
                ilustraciones de pantalla y no se imprime. El kit no: la cantidad de copias de la
                licencia no cambia el precio y volver a pedirlo cobraba el kit otra vez. */}
            {GENERATED_STATUSES.has(order.status) && !isCards && !isKit && print && (
              <Link
                href={{
                  pathname: '/checkout/[bookId]',
                  params: { bookId: order.bookId },
                  query: { reorder: order.orderId },
                }}
                className={buttonVariants({ variant: 'outline' })}
              >
                <RotateCcw aria-hidden="true" />
                {t('reorder')}
              </Link>
            )}
            {/* Tarjetas impresas: apagado hasta tener la muestra física (Celebraciones es digital). */}
            {KIT_PRINT_CARDS &&
              GENERATED_STATUSES.has(order.status) &&
              isKit &&
              cardPieces.length > 0 && (
                <Link
                  href={{
                    pathname: '/checkout/[bookId]',
                    params: { bookId: order.bookId },
                    query: { cards: order.orderId },
                  }}
                  className={buttonVariants({ variant: 'outline' })}
                >
                  <Printer aria-hidden="true" />
                  {tKit('printCards.cta')}
                </Link>
              )}
          </div>
        )}
        {/* Venta cruzada: el cuento completo del cumpleañero, en tapa dura (DECISIONS 150). */}
        {GENERATED_STATUSES.has(order.status) && isKit && (
          <section className="grid gap-3 rounded-2xl border bg-secondary p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <BookHeart className="size-5 text-primary" aria-hidden="true" />
              {tKit('bigBook.title')}
            </h2>
            <p className="text-sm text-muted-foreground">{tKit('bigBook.text')}</p>
            <Link
              href={{ pathname: '/create', query: { line: 'families' } }}
              data-track="kit_big_book"
              className={buttonVariants({ className: 'w-fit' })}
            >
              {tKit('bigBook.cta')}
            </Link>
          </section>
        )}
        {order.canDownload && isKit && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {['book', ...kitFiles].map((file) => (
              <li key={file}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void run('download', file)}
                  className="flex w-full items-center gap-2 rounded-xl border bg-card px-4 py-3 text-left text-sm font-semibold hover:border-primary/40 disabled:opacity-60"
                >
                  {busy === `download:${file}` ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="size-4 text-primary" aria-hidden="true" />
                  )}
                  {tKit(`pieces.${file === 'book' ? 'mini_book' : file}.name`)}
                </button>
              </li>
            ))}
          </ul>
        )}
        {order.canDownload && isKit && (
          <section className="grid gap-2 rounded-2xl border bg-card p-5">
            <h2 className="text-lg font-semibold">{tKit('printGuide.title')}</h2>
            <ul className="grid list-disc gap-1.5 pl-5 text-sm text-muted-foreground">
              {(['tip1', 'tip2', 'tip3', 'tip4'] as const).map((tip) => (
                <li key={tip}>{tKit(`printGuide.${tip}`)}</li>
              ))}
            </ul>
          </section>
        )}
        {/* Opinión del cliente (libro recibido o digital listo), una sola vez por pedido. */}
        {order.canReview && <OrderReview orderId={order.orderId} initial={order.review} />}
        {order.tracking?.number && (
          <p className="text-sm text-muted-foreground">
            {t('trackingNumber', { number: order.tracking.number })}
          </p>
        )}

        {(order.canSimulatePayment || order.canSimulatePrint) && (
          <div className="rounded-2xl border border-dashed bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <FlaskConical className="size-4" aria-hidden="true" />
              {t('simulateTitle')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {order.canSimulatePayment ? t('simulateText') : t('simulatePrintText')}
            </p>
            <Button
              className="mt-3"
              size="sm"
              disabled={busy !== null}
              onClick={() => void run(order.canSimulatePayment ? 'payment' : 'print')}
            >
              {(busy === 'payment' || busy === 'print') && (
                <Loader2 className="animate-spin" aria-hidden="true" />
              )}
              {order.canSimulatePayment ? t('simulate') : t('simulatePrint')}
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        )}
      </div>
      {/* Columna del costado: los datos del pedido, el precio, ayuda y qué hacer después. */}
      <aside className="grid content-start gap-4 lg:sticky lg:top-28">
        <section className="grid gap-5 rounded-2xl border bg-card p-6">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div className="grid gap-0.5">
              <dt className="text-muted-foreground">{t('details.number')}</dt>
              <dd className="font-semibold tabular-nums">
                {order.orderId.slice(0, 8).toUpperCase()}
              </dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-muted-foreground">{t('details.date')}</dt>
              <dd className="font-semibold">
                {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                  new Date(order.createdAt),
                )}
              </dd>
            </div>
          </dl>
          {order.priceSnapshot && (
            <div className="border-t pt-5">
              <PriceSummary snapshot={order.priceSnapshot} country={country} format={format} />
            </div>
          )}
        </section>
        {finished && !isCards && (
          <section className="grid gap-3 rounded-2xl bg-secondary p-5">
            <p className="font-serif text-lg leading-snug font-semibold">{t('next.title')}</p>
            <p className="text-sm text-muted-foreground">{t('next.text')}</p>
            <Link
              href="/new"
              data-track="pedido_crear_otro"
              className={buttonVariants({ variant: 'outline', className: 'w-fit' })}
            >
              <Sparkles aria-hidden="true" />
              {t('next.cta')}
            </Link>
          </section>
        )}
        <p className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
          <LifeBuoy className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {t('help.text')}{' '}
            <Link
              href="/faq"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              {t('help.link')}
            </Link>
          </span>
        </p>
      </aside>
    </div>
  );
}
