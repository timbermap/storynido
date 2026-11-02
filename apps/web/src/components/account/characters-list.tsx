'use client';

import { ApiError } from '@storynido/shared';
import { Loader2, Pencil, Trash2, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Pager } from '@/components/pager';
import { Button, buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { listChildren, type ChildSummary } from '@/lib/firebase/account';
import { getFirebaseDb } from '@/lib/firebase/client';
import { clearStepDrafts } from '@/lib/use-step-draft';

const PAGE_SIZE = 5;

/** Los personajes (chicos) para quienes ya se creó un cuento: de a 5 por página, con editar y borrar. */
export function CharactersList({ uid, onDeleted }: { uid: string; onDeleted?: () => void }) {
  const t = useTranslations('Account.myStories');
  const tChildren = useTranslations('Account.children');
  const [children, setChildren] = useState<ChildSummary[] | null>(null);
  const [page, setPage] = useState(0);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    void getFirebaseDb()
      .then((db) => listChildren(db, uid))
      .then(setChildren)
      .catch(() => {
        setChildren([]);
      });
  }, [uid]);

  async function remove(child: ChildSummary) {
    setBusy(child.id);
    setMessage(null);
    try {
      const result = await api('deleteChild', { params: { childId: child.id } });
      setChildren((current) => current?.filter((item) => item.id !== child.id) ?? null);
      // Los borradores del chico se borraron en el servidor: lo que quedó escrito acá también.
      clearStepDrafts();
      setMessage({
        text:
          result.keptOrderedBooks > 0
            ? tChildren('deletedKept', { name: child.name, count: result.keptOrderedBooks })
            : tChildren('deleted', { name: child.name }),
        error: false,
      });
      onDeleted?.();
    } catch (caught) {
      setMessage({
        text: caught instanceof ApiError ? caught.message : tChildren('error'),
        error: true,
      });
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  if (children === null) return null;
  const pages = Math.max(1, Math.ceil(children.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{t('charactersNote')}</p>
      {message && (
        <p
          role={message.error ? 'alert' : 'status'}
          className={message.error ? 'text-sm font-semibold text-destructive' : 'text-sm'}
        >
          {message.text}
        </p>
      )}
      {children.length === 0 ? (
        <p className="rounded-xl border bg-card p-5">{t('charactersEmpty')}</p>
      ) : (
        <ul className="grid gap-3">
          {children.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE).map((child) => (
            <li key={child.id} className="grid gap-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <UserRound className="size-5 text-primary" aria-hidden="true" />
                <p className="min-w-0 flex-1 font-semibold">
                  <Link
                    href={{
                      pathname: '/my-stories/characters/[childId]',
                      params: { childId: child.id },
                    }}
                    className="underline-offset-4 hover:underline"
                  >
                    {child.name}
                  </Link>
                  {child.age !== null && (
                    <span className="font-normal text-muted-foreground">
                      {' · '}
                      {t('charactersAge', { age: child.age })}
                    </span>
                  )}
                </p>
                {confirming === child.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">{tChildren('confirm', { name: child.name })}</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy !== null}
                      onClick={() => void remove(child)}
                    >
                      {busy === child.id && <Loader2 className="animate-spin" aria-hidden="true" />}
                      {tChildren('confirmDelete')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy !== null}
                      onClick={() => {
                        setConfirming(null);
                      }}
                    >
                      {tChildren('cancel')}
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Link
                      href={{
                        pathname: '/my-stories/characters/[childId]',
                        params: { childId: child.id },
                      }}
                      className={buttonVariants({ size: 'sm', variant: 'outline' })}
                    >
                      <Pencil aria-hidden="true" />
                      {t('characterEdit')}
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setConfirming(child.id);
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                      {tChildren('delete')}
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pager page={current} pages={pages} onChange={setPage} />
    </div>
  );
}
