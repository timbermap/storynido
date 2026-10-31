'use client';

import { ApiError } from '@storynido/shared';
import { Loader2, Pencil, Trash2, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Pager } from '@/components/pager';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { listChildren, updateChildProfile, type ChildSummary } from '@/lib/firebase/account';
import { getFirebaseDb } from '@/lib/firebase/client';
import { clearStepDrafts } from '@/lib/use-step-draft';

const PAGE_SIZE = 5;
const field = 'h-11 rounded-xl border bg-card px-3';

/** Los personajes (chicos) para quienes ya se creó un cuento: de a 5 por página, con editar y borrar. */
export function CharactersList({ uid, onDeleted }: { uid: string; onDeleted?: () => void }) {
  const t = useTranslations('Account.myStories');
  const tChildren = useTranslations('Account.children');
  const [children, setChildren] = useState<ChildSummary[] | null>(null);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<{ id: string; name: string; age: number } | null>(null);
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

  async function save() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    setBusy(editing.id);
    setMessage(null);
    try {
      await updateChildProfile(await getFirebaseDb(), editing.id, { name, age: editing.age });
      setChildren(
        (current) =>
          current?.map((item) =>
            item.id === editing.id ? { ...item, name, age: editing.age } : item,
          ) ?? null,
      );
      setMessage({ text: t('characterSaved', { name }), error: false });
      setEditing(null);
    } catch {
      setMessage({ text: t('characterSaveError'), error: true });
    } finally {
      setBusy(null);
    }
  }

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
              {editing?.id === child.id ? (
                <form
                  className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save();
                  }}
                >
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold">{t('characterName')}</span>
                    <input
                      value={editing.name}
                      maxLength={40}
                      required
                      onChange={(event) => {
                        setEditing({ ...editing, name: event.target.value });
                      }}
                      className={field}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold">{t('characterAge')}</span>
                    <select
                      value={editing.age}
                      onChange={(event) => {
                        setEditing({ ...editing, age: Number(event.target.value) });
                      }}
                      className={field}
                    >
                      {Array.from({ length: 13 }, (_, age) => (
                        <option key={age} value={age}>
                          {age}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={busy !== null}>
                      {busy === child.id && <Loader2 className="animate-spin" aria-hidden="true" />}
                      {t('characterSave')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(null);
                      }}
                    >
                      {tChildren('cancel')}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-3">
                    {t('characterEditNote')}
                  </p>
                </form>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <UserRound className="size-5 text-primary" aria-hidden="true" />
                  <p className="min-w-0 flex-1 font-semibold">
                    {child.name}
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
                        {busy === child.id && (
                          <Loader2 className="animate-spin" aria-hidden="true" />
                        )}
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setMessage(null);
                          setEditing({ id: child.id, name: child.name, age: child.age ?? 0 });
                        }}
                      >
                        <Pencil aria-hidden="true" />
                        {t('characterEdit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(null);
                          setConfirming(child.id);
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                        {tChildren('delete')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Pager page={current} pages={pages} onChange={setPage} />
    </div>
  );
}
