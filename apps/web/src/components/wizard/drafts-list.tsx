'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import type { DraftSummary } from '@/lib/firebase/drafts';

/** Borradores para retomar (en el creador y en Mi cuenta). */
export function DraftsList({ drafts }: { drafts: DraftSummary[] }) {
  const t = useTranslations('Wizard.drafts');
  const date = new Intl.DateTimeFormat(useLocale(), { dateStyle: 'medium' });
  return (
    <ul className="grid gap-3">
      {drafts.map((draft) => (
        <li
          key={draft.id}
          className="flex items-center justify-between gap-4 rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]"
        >
          <div>
            <p className="font-display text-lg font-semibold">
              {draft.childName ? t('of', { name: draft.childName }) : t('untitled')}
            </p>
            {draft.updatedAt && (
              <p className="text-sm text-muted-foreground">
                {t('updated', { date: date.format(draft.updatedAt) })}
              </p>
            )}
          </div>
          <Link
            href={{ pathname: '/create/[bookId]', params: { bookId: draft.id } }}
            className="font-extrabold text-primary hover:underline"
          >
            {t('continue')}
          </Link>
        </li>
      ))}
    </ul>
  );
}
