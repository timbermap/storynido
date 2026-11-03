'use client';

import { COLLECTIONS, type BookFormat } from '@storynido/shared';
import { doc, getDoc } from 'firebase/firestore';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { LineChip, Thumb } from '@/components/home/session/parts';
import { getFirebaseDb } from '@/lib/firebase/client';
import { channelOf, previewOf } from '@/lib/firebase/home-data';
import type { HomeChannel } from '@/lib/home-state';

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
}: {
  orderId: string;
  bookId: string;
  /** Formato pedido («Cuento grapado», «Tapa dura»…); null en un pedido de tarjetas. */
  format: BookFormat | null;
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

  if (!header) return <div className="h-28 rounded-2xl bg-border/60" aria-hidden="true" />;
  return (
    <header className="flex items-center gap-4 sm:gap-5">
      <span className="relative block aspect-[3/4] w-[72px] shrink-0 overflow-hidden rounded-[6px_12px_12px_6px] bg-muted shadow-[0_10px_18px_-12px_rgb(38_50_74/0.5)] sm:w-[88px]">
        <Thumb
          src={header.coverUrl}
          story={undefined}
          name={null}
          line={header.line}
          sizes="88px"
        />
      </span>
      <div className="grid min-w-0 gap-1.5">
        <LineChip line={header.line} label={tLines(`lines.${header.line}`)} />
        <p className="font-serif text-xl leading-snug font-semibold text-balance sm:text-2xl">
          {header.title ?? t('finishedUntitled')}
        </p>
        {format && <p className="text-sm text-muted-foreground">{tFormats(`${format}.name`)}</p>}
      </div>
    </header>
  );
}
