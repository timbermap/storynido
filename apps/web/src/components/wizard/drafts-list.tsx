'use client';

import { Loader2, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { DraftSummary } from '@/lib/firebase/drafts';

/** Borradores para retomar o borrar (en el creador y en Mi cuenta). */
export function DraftsList({
  drafts,
  onDeleted,
}: {
  drafts: DraftSummary[];
  onDeleted: (id: string) => void;
}) {
  const t = useTranslations('Wizard.drafts');
  const date = new Intl.DateTimeFormat(useLocale(), { dateStyle: 'medium' });
  // Borrar pide confirmación en la misma fila: se pierden la muestra y sus ilustraciones.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function remove(id: string) {
    setDeleting(id);
    setFailed(null);
    try {
      await api('deleteDraft', { params: { bookId: id } });
      onDeleted(id);
    } catch {
      setFailed(id);
    } finally {
      setDeleting(null);
      setConfirming(null);
    }
  }

  return (
    <ul className="grid gap-3">
      {drafts.map((draft) => {
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
                <p className="font-display text-lg font-semibold">{title}</p>
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
                  {deleting === draft.id && <Loader2 className="animate-spin" aria-hidden="true" />}
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
  );
}
