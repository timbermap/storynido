'use client';

import { UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Pager } from '@/components/pager';
import { listChildren, type ChildSummary } from '@/lib/firebase/account';
import { getFirebaseDb } from '@/lib/firebase/client';

const PAGE_SIZE = 5;

/** Los personajes (chicos) para quienes ya se creó un cuento, de a 5 por página. */
export function CharactersList({ uid }: { uid: string }) {
  const t = useTranslations('Account.myStories');
  const [children, setChildren] = useState<ChildSummary[] | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    void getFirebaseDb()
      .then((db) => listChildren(db, uid))
      .then(setChildren)
      .catch(() => {
        setChildren([]);
      });
  }, [uid]);

  if (children === null) return null;
  const pages = Math.max(1, Math.ceil(children.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{t('charactersNote')}</p>
      {children.length === 0 ? (
        <p className="rounded-xl border bg-card p-5">{t('charactersEmpty')}</p>
      ) : (
        <ul className="grid gap-3">
          {children.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE).map((child) => (
            <li key={child.id} className="flex items-center gap-3 rounded-xl border bg-card p-4">
              <UserRound className="size-5 text-primary" aria-hidden="true" />
              <p className="font-semibold">
                {child.name}
                {child.age !== null && (
                  <span className="font-normal text-muted-foreground">
                    {' · '}
                    {t('charactersAge', { age: child.age })}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Pager page={current} pages={pages} onChange={setPage} />
    </div>
  );
}
