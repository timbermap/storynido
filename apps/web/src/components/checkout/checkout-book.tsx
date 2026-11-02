'use client';

import type { PublicPreview } from '@storynido/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';

/**
 * Lo que se está comprando: la portada y el título del cuento aprobado, para que el pago no
 * parezca un formulario genérico (auditoría de conversión). Si la vista previa no se puede leer,
 * no muestra nada y el pago sigue igual.
 */
export function CheckoutBook({ bookId }: { bookId: string }) {
  const t = useTranslations('Checkout');
  const [book, setBook] = useState<{ title: string; coverUrl: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api('bookPreview', { params: { bookId } })
      .then((result: PublicPreview) => {
        if (!cancelled && result.preview) {
          setBook({ title: result.preview.title, coverUrl: result.preview.coverUrl });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  if (!book) return null;
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 lg:col-span-2">
      {book.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- URL firmada de 30 min.
        <img
          src={book.coverUrl}
          alt=""
          className="aspect-[3/4] w-20 shrink-0 rounded-lg border object-cover"
        />
      )}
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {t('yourBook')}
        </p>
        <p className="font-display text-xl leading-tight font-semibold">{book.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('yourBookText')}</p>
      </div>
    </div>
  );
}
