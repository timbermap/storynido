'use client';

import type { AdminShowcaseBook, ShowcaseStatus } from '@storynido/shared';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, Notice, PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { errorMessage, useApi } from '@/lib/use-api';

const STATUS_LABEL: Record<ShowcaseStatus, string> = {
  pending: 'Por aprobar',
  approved: 'Publicado',
  rejected: 'No se muestra',
};

/**
 * Ejemplos de la mesa (DECISIONS 348): libros del golden set que pasaron la mesa de jueces. Se
 * aprueban uno por uno; la web abre «Así queda un libro real» recién con el mínimo aprobado.
 */
export default function ShowcasePage() {
  const load = useCallback(() => api('adminShowcase'), []);
  const { data, setData, error } = useApi(load);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const setStatus = async (book: AdminShowcaseBook, status: ShowcaseStatus) => {
    setBusy(book.id);
    setActionError(null);
    try {
      const updated = await api('adminSetShowcaseStatus', {
        params: { id: book.id },
        body: { status },
      });
      setData((current) => {
        if (!current) return current;
        const books = current.books.map((item) => (item.id === updated.id ? updated : item));
        const approvedByLocale: Record<string, number> = {};
        for (const item of books) {
          if (item.status === 'approved' && item.eligible) {
            approvedByLocale[item.locale] = (approvedByLocale[item.locale] ?? 0) + 1;
          }
        }
        return { ...current, books, approvedByLocale };
      });
    } catch (caught) {
      setActionError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const approvedEs = data?.approvedByLocale.es ?? 0;
  return (
    <>
      <PageHeader
        title="Ejemplos de la mesa"
        text="Libros del golden set (chicos inventados) con nota de la mesa 4 o más, que el comprador compraría y sin fallas duras. Se muestran tal cual salieron, en la ficha de cada cuento y en «Cómo funciona»."
      />
      {error && <Notice tone="error">{error}</Notice>}
      {actionError && <Notice tone="error">{actionError}</Notice>}
      {data && (
        <div className="grid gap-4">
          <Notice>
            {approvedEs >= data.minBooks
              ? `La sección «Así queda un libro real» está abierta en español (${String(approvedEs)} publicados).`
              : `La sección está oculta: hay ${String(approvedEs)} de ${String(data.minBooks)} libros publicados en español. Se abre sola al llegar a ${String(data.minBooks)}.`}
          </Notice>
          {data.books.length === 0 && (
            <Card>
              <p className="text-sm text-muted-foreground">
                Todavía no hay libros. Se suben desde una corrida del golden set con{' '}
                <code className="font-mono text-xs">
                  pnpm --filter @storynido/providers showcase:import eval-reports/pedidos-… --yes
                </code>
                .
              </p>
            </Card>
          )}
          {data.books.map((book) => (
            <Card key={book.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{book.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {book.childName}, {book.age} años · {book.storySlug} · {book.styleSlug} ·{' '}
                    {book.channel} · {book.locale}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Corrida {book.source.report} · {book.source.caseId}
                    {book.reviewedBy ? ` · revisó ${book.reviewedBy}` : ''}
                  </p>
                </div>
                <span className="rounded-full border px-3 py-1 text-xs font-semibold">
                  {STATUS_LABEL[book.status]}
                </span>
              </div>
              <p className="mt-3 text-sm">
                <span className="font-semibold">Mesa {book.panel.score ?? '-'}/5</span>
                {book.panel.weakest ? ` (la más baja: ${book.panel.weakest})` : ''} · comprador{' '}
                {book.panel.verdict ?? '-'}
                {Object.keys(book.panel.judges).length > 0 &&
                  ` · ${Object.entries(book.panel.judges)
                    .map(([judge, score]) => `${judge} ${String(score)}`)
                    .join(' · ')}`}
              </p>
              {book.panel.loved.length > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Le encantó: {book.panel.loved.join('; ')}
                </p>
              )}
              {!book.eligible && (
                <p className="mt-2 text-sm text-destructive">
                  No califica: {book.reasons.join('; ')}
                </p>
              )}
              <ol className="mt-3 flex gap-2 overflow-x-auto pb-2">
                {[{ image: book.cover, text: 'Tapa' }, ...book.pages].map((page, index) => (
                  <li key={index} className="w-40 shrink-0">
                    {page.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={page.image}
                        alt={index === 0 ? 'Tapa' : `Página ${String(index)}`}
                        className="aspect-[3/4] w-full rounded-md border object-cover"
                      />
                    ) : (
                      <div className="grid aspect-[3/4] place-items-center rounded-md border text-xs text-muted-foreground">
                        Sin imagen
                      </div>
                    )}
                    <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{page.text}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex flex-wrap gap-2">
                {book.status !== 'approved' && (
                  <Button
                    size="sm"
                    disabled={!book.eligible || busy === book.id}
                    onClick={() => void setStatus(book, 'approved')}
                  >
                    Aprobar y publicar
                  </Button>
                )}
                {book.status !== 'rejected' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === book.id}
                    onClick={() => void setStatus(book, 'rejected')}
                  >
                    {book.status === 'approved' ? 'Retirar de la web' : 'No mostrar'}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
