'use client';

import { ApiError } from '@storynido/shared';
import { Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { listChildren, type ChildSummary } from '@/lib/firebase/account';
import { getFirebaseDb } from '@/lib/firebase/client';

/** Perfiles de los chicos y el borrado de sus datos (fotos y borradores) a pedido. */
export function ChildrenList({ uid }: { uid: string }) {
  const t = useTranslations('Account.children');
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    void getFirebaseDb()
      .then((db) => listChildren(db, uid))
      .then(setChildren);
  }, [uid]);

  async function remove(child: ChildSummary) {
    setDeleting(child.id);
    setMessage(null);
    try {
      const result = await api('deleteChild', { params: { childId: child.id } });
      setChildren((current) => current.filter((item) => item.id !== child.id));
      setMessage({
        text:
          result.keptOrderedBooks > 0
            ? t('deletedKept', { name: child.name, count: result.keptOrderedBooks })
            : t('deleted', { name: child.name }),
        error: false,
      });
    } catch (caught) {
      setMessage({
        text: caught instanceof ApiError ? caught.message : t('error'),
        error: true,
      });
    } finally {
      setDeleting(null);
      setConfirming(null);
    }
  }

  if (children.length === 0 && !message) return null;

  return (
    <section id="children" className="grid scroll-mt-28 gap-4">
      <div>
        <h2 className="text-2xl font-medium">{t('title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('note')}</p>
      </div>
      <ul className="grid gap-3">
        {children.map((child) => (
          <li
            key={child.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4"
          >
            <p className="min-w-0 flex-1 font-semibold">
              {child.name}
              {child.age !== null && (
                <span className="font-normal text-muted-foreground">
                  {' '}
                  · {t('age', { age: child.age })}
                </span>
              )}
            </p>
            {confirming === child.id ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">{t('confirm', { name: child.name })}</span>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={deleting !== null}
                  onClick={() => void remove(child)}
                >
                  {deleting === child.id && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {t('confirmDelete')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={deleting !== null}
                  onClick={() => {
                    setConfirming(null);
                  }}
                >
                  {t('cancel')}
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setConfirming(child.id);
                }}
              >
                <Trash2 aria-hidden="true" />
                {t('delete')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {message && (
        <p
          role={message.error ? 'alert' : 'status'}
          className={message.error ? 'text-sm font-semibold text-destructive' : 'text-sm'}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
