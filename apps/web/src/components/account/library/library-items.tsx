'use client';

import { Download, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';

import type { OrderStatus, PublicStory } from '@storynido/shared';

import {
  LineChip,
  StatusChip,
  Thumb,
  cardClass,
  type LineCopy,
} from '@/components/home/session/parts';
import { OrderTimeline } from '@/components/orders/timeline';
import { Button, buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { HomeBook, HomeChannel } from '@/lib/home-state';
import { isCardsOrder, orderFormat, type LibraryOrder } from '@/lib/library';
import { cn } from '@/lib/utils';
import { clearStepDrafts } from '@/lib/use-step-draft';

const COVER =
  'relative block aspect-[3/4] shrink-0 overflow-hidden rounded-[6px_12px_12px_6px] bg-muted shadow-[0_10px_18px_-12px_rgb(38_50_74/0.5)]';

/** Estado de un pedido en curso para su píldora. */
function orderStatusKey(status: string) {
  if (status === 'shipped') return 'shipped';
  if (status === 'sent_to_print' || status === 'in_production' || status === 'ready') {
    return 'printing';
  }
  return 'preparing';
}

/**
 * La tarjeta de Mis cuentos, igual para todos los estados: la portada, la línea siempre, el
 * título en Lora, la fecha y el formato, y las acciones a la derecha (abajo en el celular).
 */
function LibraryCard({
  cover,
  line,
  lineLabel,
  status,
  title,
  meta,
  actions,
  children,
}: {
  cover: ReactNode;
  line: HomeChannel;
  lineLabel: string;
  status: string;
  title: string;
  meta: string | null;
  actions: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li
      className={cn(
        cardClass,
        'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-5',
      )}
    >
      <span className={cn(COVER, 'w-[60px] sm:w-[72px]')}>{cover}</span>
      <div className="grid min-w-0 gap-1">
        <div className="flex flex-wrap gap-1.5">
          <LineChip line={line} label={lineLabel} small />
          <StatusChip>{status}</StatusChip>
        </div>
        <p className="line-clamp-2 font-serif text-lg leading-snug font-semibold">{title}</p>
        {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
      </div>
      <div className="col-span-full flex flex-wrap items-center gap-2 sm:col-span-1 sm:justify-end">
        {actions}
      </div>
      {children && <div className="col-span-full">{children}</div>}
    </li>
  );
}

/** Un cuento en creación: retomarlo o borrarlo (con confirmación). */
export function DraftCard({
  book,
  lines,
  story,
  onDeleted,
}: {
  book: HomeBook;
  lines: LineCopy;
  story: PublicStory | undefined;
  onDeleted: () => void;
}) {
  const t = useTranslations('Account.myStories.library');
  const tDrafts = useTranslations('Wizard.drafts');
  const date = new Intl.DateTimeFormat(useLocale(), { dateStyle: 'medium' });
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  const title =
    book.title ??
    (book.childName
      ? tDrafts('of', { name: book.childName })
      : tDrafts(`untitled.${book.channel}`));
  const status = book.stage === 'preview' && book.channel === 'events' ? 'kitPreview' : book.stage;

  async function remove() {
    setDeleting(true);
    setFailed(false);
    try {
      await api('deleteDraft', { params: { bookId: book.id } });
      clearStepDrafts(book.id);
      onDeleted();
    } catch {
      setFailed(true);
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <LibraryCard
      cover={
        <Thumb
          src={book.coverUrl ?? (book.stage === 'character' ? book.characterUrl : null)}
          story={story}
          name={book.childName}
          line={book.channel}
          sizes="72px"
        />
      }
      line={book.channel}
      lineLabel={lines[book.channel].chip}
      status={t(`status.${status}`)}
      title={title}
      meta={book.updatedAt ? tDrafts('updated', { date: date.format(book.updatedAt) }) : null}
      actions={
        <>
          <Link
            href={{ pathname: '/create/[bookId]', params: { bookId: book.id } }}
            className={buttonVariants({ size: 'sm', variant: 'outline' })}
          >
            {book.stage === 'preview' ? t('seePreview') : tDrafts('continue')}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label={tDrafts('delete', { title })}
            onClick={() => {
              setConfirming(true);
            }}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </>
      }
    >
      {confirming && (
        <div
          role="alertdialog"
          aria-label={tDrafts('deleteConfirm')}
          className="flex flex-wrap items-center gap-3 rounded-lg bg-muted p-3 text-sm"
        >
          <span className="flex-1">{tDrafts('deleteConfirm')}</span>
          <Button size="sm" variant="destructive" disabled={deleting} onClick={() => void remove()}>
            {deleting && <Loader2 className="animate-spin" aria-hidden="true" />}
            {tDrafts('deleteYes')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setConfirming(false);
            }}
          >
            {tDrafts('deleteNo')}
          </Button>
        </div>
      )}
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {tDrafts('deleteFailed')}
        </p>
      )}
    </LibraryCard>
  );
}

/** Formato y fecha de un pedido («Tapa dura · 2 nov 2026»). */
function useOrderMeta() {
  const tFormats = useTranslations('Checkout.formats');
  const tKit = useTranslations('Account.myStories.library');
  const date = new Intl.DateTimeFormat(useLocale(), { dateStyle: 'medium' });
  return (order: LibraryOrder) => {
    const format = orderFormat(order);
    const name = format === 'card' ? tKit('cards') : tFormats(`${format}.name`);
    return order.createdAt ? `${name} · ${date.format(order.createdAt)}` : name;
  };
}

/** Un pedido en curso: su estado, los cinco pasos y el pedido. */
export function OrderCard({
  order,
  lines,
  story,
}: {
  order: LibraryOrder;
  lines: LineCopy;
  story: PublicStory | undefined;
}) {
  const t = useTranslations('Account.myStories.library');
  const tOrders = useTranslations('Account.myStories');
  const meta = useOrderMeta();
  const shipped = order.status === 'shipped';
  return (
    <LibraryCard
      cover={
        <Thumb
          src={order.coverUrl}
          story={story}
          name={order.childName}
          line={order.channel}
          sizes="72px"
        />
      }
      line={order.channel}
      lineLabel={lines[order.channel].chip}
      status={t(`status.${orderStatusKey(order.status)}`)}
      title={order.title ?? tOrders('finishedUntitled')}
      meta={meta(order)}
      actions={
        <Link
          href={{ pathname: '/order/[orderId]', params: { orderId: order.id } }}
          className={buttonVariants({ size: 'sm', variant: 'outline' })}
        >
          {shipped ? t('track') : t('viewOrder')}
        </Link>
      }
    >
      <OrderTimeline status={order.status as OrderStatus} print={order.print} compact />
    </LibraryCard>
  );
}

const ACTION =
  'inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-primary underline-offset-4 hover:underline disabled:opacity-60';

/**
 * Un libro terminado en el estante: la portada grande, Ver, Descargar PDF (si se puede) y volver a
 * pedirlo. Un ebook ofrece la versión impresa; un impreso, otra copia.
 */
export function ShelfItem({
  order,
  lines,
  story,
}: {
  order: LibraryOrder;
  lines: LineCopy;
  story: PublicStory | undefined;
}) {
  const t = useTranslations('Account.myStories.library');
  const tOrders = useTranslations('Account.myStories');
  const meta = useOrderMeta();
  const [info, setInfo] = useState<{ canDownload: boolean; kit: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const cards = isCardsOrder(order);

  // La API dice si el PDF ya se puede descargar y si es un kit (se descarga el ZIP).
  useEffect(() => {
    if (cards) return;
    let cancelled = false;
    void api('order', { params: { orderId: order.id } })
      .then((found) => {
        if (!cancelled) {
          setInfo({ canDownload: found.canDownload, kit: found.files.includes('kit_zip') });
        }
      })
      .catch(() => {
        if (!cancelled) setInfo({ canDownload: false, kit: false });
      });
    return () => {
      cancelled = true;
    };
  }, [order.id, cards]);

  async function download() {
    setBusy(true);
    setError(false);
    try {
      const { url } = await api('orderDownload', {
        params: { orderId: order.id },
        query: { file: info?.kit ? 'kit_zip' : 'book' },
      });
      window.location.assign(url);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const title = order.title ?? tOrders('finishedUntitled');
  const orderHref = { pathname: '/order/[orderId]', params: { orderId: order.id } } as const;
  const reorder = {
    pathname: '/checkout/[bookId]',
    params: { bookId: order.bookId },
    query: { reorder: order.id, ...(info?.kit ? { kit: '1' } : {}) },
  } as const;
  // Otra copia solo de un libro impreso (el PDF ya lo tiene) o más copias de un kit. Un ebook
  // se creó con ilustraciones de pantalla: no se imprime, se ve y se descarga.
  const canReorder = order.print || info?.kit === true;

  return (
    <li className="grid content-start gap-2">
      <Link
        href={orderHref}
        data-track="leer"
        className={cn(
          COVER,
          'w-full rounded-[8px_16px_16px_8px] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none',
        )}
        aria-label={t('readLabel', { title })}
      >
        <Thumb
          src={order.coverUrl}
          story={story}
          name={order.childName}
          line={order.channel}
          sizes="(min-width: 1024px) 240px, (min-width: 640px) 30vw, 45vw"
        />
      </Link>
      <LineChip line={order.channel} label={lines[order.channel].chip} small />
      <p className="line-clamp-2 font-serif text-base leading-snug font-semibold sm:text-lg">
        {title}
      </p>
      <p className="text-sm text-muted-foreground">{meta(order)}</p>
      <div className="flex flex-wrap gap-x-4">
        <Link href={orderHref} data-track="leer" className={ACTION}>
          {t('read')}
        </Link>
        {info?.canDownload && (
          <button type="button" disabled={busy} onClick={() => void download()} className={ACTION}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
            {t('download')}
          </button>
        )}
        {!cards && canReorder && (
          <Link
            href={reorder}
            data-track={order.print ? 'pedir-copia' : 'pedir-de-nuevo'}
            className={ACTION}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {order.print ? t('anotherCopy') : t('reorder')}
          </Link>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t('downloadError')}
        </p>
      )}
    </li>
  );
}
