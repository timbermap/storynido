'use client';

import { CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Pager } from '@/components/pager';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { clearStepDrafts } from '@/lib/use-step-draft';
import { getFirebaseDb } from '@/lib/firebase/client';
import { readDraftState, type DraftSummary } from '@/lib/firebase/drafts';

/** Color de contexto de cada línea (el mismo de su landing). */
export const LINE_TONE = {
  families: 'bg-mint text-success',
  events: 'bg-peach text-navy',
  professionals: 'bg-secondary text-navy',
} as const;

/** Etiqueta de la línea (Familia, Celebración, Profesional), con su color. */
export function LineBadge({ line }: { line: keyof typeof LINE_TONE }) {
  const tLines = useTranslations('Nav.lines');
  return (
    <span
      className={cn(
        'mb-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold',
        LINE_TONE[line],
      )}
    >
      {tLines(line)}
    </span>
  );
}

/** Borradores para retomar o borrar (en el creador y en Mi cuenta). */
export function DraftsList({
  drafts,
  onDeleted,
  pageSize = 5,
}: {
  drafts: DraftSummary[];
  onDeleted: (id: string) => void;
  /** Cuántos se ven por página: con muchos borradores la lista no se vuelve interminable. */
  pageSize?: number;
}) {
  const t = useTranslations('Wizard.drafts');
  const date = new Intl.DateTimeFormat(useLocale(), { dateStyle: 'medium' });
  // Borrar pide confirmación en la misma fila: se pierden la muestra y sus ilustraciones.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  // Estado en vivo de las muestras que se están dibujando (se consulta cada pocos segundos).
  const [live, setLive] = useState<Record<string, Pick<DraftSummary, 'status' | 'generating'>>>({});
  const stateOf = (draft: DraftSummary) => live[draft.id] ?? draft;
  const generatingIds = drafts
    .filter((draft) => stateOf(draft).generating)
    .map((draft) => draft.id)
    .join(',');
  useEffect(() => {
    if (!generatingIds) return;
    const timer = setInterval(() => {
      void getFirebaseDb().then(async (db) => {
        for (const id of generatingIds.split(',')) {
          const next = await readDraftState(db, id).catch(() => null);
          if (next) setLive((current) => ({ ...current, [id]: next }));
        }
      });
    }, 6000);
    return () => {
      clearInterval(timer);
    };
  }, [generatingIds]);
  const pages = Math.max(1, Math.ceil(drafts.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = drafts.slice(current * pageSize, (current + 1) * pageSize);

  async function remove(id: string) {
    setDeleting(id);
    setFailed(null);
    try {
      await api('deleteDraft', { params: { bookId: id } });
      clearStepDrafts(id);
      onDeleted(id);
    } catch {
      setFailed(id);
    } finally {
      setDeleting(null);
      setConfirming(null);
    }
  }

  return (
    <div className="grid gap-4">
      <ul className="grid gap-3">
        {visible.map((draft) => {
          const title = draft.childName
            ? t('of', { name: draft.childName })
            : t(`untitled.${draft.channel}`);
          return (
            <li
              key={draft.id}
              className="grid gap-3 rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <LineBadge line={draft.channel} />
                  <p className="font-display text-lg font-semibold">{title}</p>
                  {stateOf(draft).generating ? (
                    <p
                      role="status"
                      className="mt-1 flex items-center gap-2 text-sm font-semibold text-primary"
                    >
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      {t('generating')}
                    </p>
                  ) : stateOf(draft).status === 'preview_ready' ? (
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-success">
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                      {t('previewReady')}
                    </p>
                  ) : null}
                  {draft.updatedAt && (
                    <p className="text-sm text-muted-foreground">
                      {t('updated', { date: date.format(draft.updatedAt) })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={{ pathname: '/create/[bookId]', params: { bookId: draft.id } }}
                    className="font-semibold text-primary hover:underline"
                  >
                    {t('continue')}
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('delete', { title })}
                    onClick={() => {
                      setConfirming(draft.id);
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
              {confirming === draft.id && (
                <div
                  role="alertdialog"
                  aria-label={t('deleteConfirm')}
                  className="flex flex-wrap items-center gap-3 rounded-lg bg-muted p-3 text-sm"
                >
                  <span className="flex-1">{t('deleteConfirm')}</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={deleting === draft.id}
                    onClick={() => void remove(draft.id)}
                  >
                    {deleting === draft.id && (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    )}
                    {t('deleteYes')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setConfirming(null);
                    }}
                  >
                    {t('deleteNo')}
                  </Button>
                </div>
              )}
              {failed === draft.id && (
                <p role="alert" className="text-sm text-destructive">
                  {t('deleteFailed')}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <Pager page={current} pages={pages} onChange={setPage} />
    </div>
  );
}
