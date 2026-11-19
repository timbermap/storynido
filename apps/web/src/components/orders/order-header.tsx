'use client';

import { COLLECTIONS, type BookFormat } from '@storynido/shared';
import { doc, getDoc } from 'firebase/firestore';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { LineChip, Thumb } from '@/components/home/session/parts';
import { getFirebaseDb } from '@/lib/firebase/client';
import { channelOf, previewOf } from '@/lib/firebase/home-data';
import type { HomeChannel } from '@/lib/home-state';
import { cn } from '@/lib/utils';

interface Header {
  title: string | null;
  line: HomeChannel;
  coverUrl: string | null;
}

/**
 * Cabecera del pedido: la portada del libro, su título y la línea (el pedido de la API no los
 * trae: salen del documento del pedido, que solo puede leer su dueño, y de la vista previa).
 */
export function OrderHeader({
  orderId,
  bookId,
  format,
  large = false,
}: {
  orderId: string;
  bookId: string;
  /** Formato pedido («Cuento grapado», «Tapa dura»…); null en un pedido de tarjetas. */
  format: BookFormat | null;
  /** Libro ya entregado: la portada pasa a ser lo principal de la página (DECISIONS 275). */
  large?: boolean;
}) {
  const t = useTranslations('Account.myStories');
  const tLines = useTranslations('Nav');
  const tFormats = useTranslations('Checkout.formats');
  const [header, setHeader] = useState<Header | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      getFirebaseDb().then((db) => getDoc(doc(db, COLLECTIONS.orders, orderId)).catch(() => null)),
      previewOf(bookId),
    ]).then(([order, preview]) => {
      if (cancelled) return;
      setHeader({
        title: (order?.get('bookTitle') as string | undefined) ?? preview?.preview?.title ?? null,
        line: channelOf(order?.get('channel')),
        coverUrl: preview?.preview?.coverUrl ?? null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [orderId, bookId]);

  if (!header) {
    return (
      <div
        className={cn('rounded-2xl bg-border/60', large ? 'h-40 sm:h-48' : 'h-28')}
        aria-hidden="true"
      />
    );
  }
  return (
    <header className="flex items-center gap-4 sm:gap-6">
      <span
        className={cn(
          'relative block aspect-[3/4] shrink-0 overflow-hidden rounded-[6px_12px_12px_6px] bg-muted shadow-[0_10px_18px_-12px_rgb(38_50_74/0.5)]',
          large
            ? 'w-[104px] shadow-[0_18px_30px_-16px_rgb(38_50_74/0.55)] sm:w-[144px]'
            : 'w-[72px] sm:w-[88px]',
        )}
      >
        <Thumb
          src={header.coverUrl}
          story={undefined}
          name={null}
          line={header.line}
          sizes={large ? '144px' : '88px'}
          title={header.title}
        />
      </span>
      <div className="grid min-w-0 gap-1.5">
        <LineChip line={header.line} label={tLines(`lines.${header.line}`)} />
        <p
          className={cn(
            'font-serif leading-snug font-semibold text-balance',
            large ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl',
          )}
        >
          {header.title ?? t('finishedUntitled')}
        </p>
        {format && <p className="text-sm text-muted-foreground">{tFormats(`${format}.name`)}</p>}
      </div>
    </header>
  );
}
