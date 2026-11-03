'use client';

import { ApiError } from '@storynido/shared';
import { Loader2, Plus, Trash2, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { cardClass } from '@/components/home/session/parts';
import { Button, buttonVariants } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { ChildSummary } from '@/lib/firebase/account';
import { saveReuseCharacter } from '@/lib/reuse-character';
import { cn } from '@/lib/utils';
import { clearStepDrafts } from '@/lib/use-step-draft';

/** «Crear otro cuento con…»: el mismo destino que el botón del perfil (Familias, con sus datos). */
export function useCreateWith() {
  const router = useRouter();
  return (childId: string, line: 'families' | 'events' = 'families') => {
    saveReuseCharacter(childId);
    router.push({ pathname: '/create', query: { line } });
  };
}

interface Portrait {
  imageUrl: string | null;
  stories: number;
}

/** Un personaje: su dibujo aprobado, edad, cuántos cuentos tiene y lo que le gusta. */
function CharacterCard({
  child,
  onDelete,
  busy,
}: {
  child: ChildSummary;
  onDelete: () => void;
  busy: boolean;
}) {
  const t = useTranslations('Account.myStories');
  const tLib = useTranslations('Account.myStories.library');
  const tChildren = useTranslations('Account.children');
  const createWith = useCreateWith();
  const [portrait, setPortrait] = useState<Portrait | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api('getChildProfile', { params: { childId: child.id } })
      .then((profile) => {
        if (!cancelled) {
          setPortrait({ imageUrl: profile.characterImageUrl, stories: profile.books.length });
        }
      })
      .catch(() => {
        if (!cancelled) setPortrait({ imageUrl: null, stories: -1 });
      });
    return () => {
      cancelled = true;
    };
  }, [child.id]);

  const profileHref = {
    pathname: '/my-stories/characters/[childId]',
    params: { childId: child.id },
  } as const;
  const facts = [
    child.age !== null ? t('charactersAge', { age: child.age }) : null,
    portrait && portrait.stories >= 0
      ? tLib('characters.stories', { count: portrait.stories })
      : null,
  ].filter(Boolean);

  return (
    <li className={cn(cardClass, 'grid content-start gap-4 p-5')}>
      <div className="flex items-center gap-4">
        <span className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-card bg-muted shadow-[0_0_0_1px_var(--border)]">
          {portrait?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL firmada de 30 min.
            <img
              src={portrait.imageUrl}
              alt={t('profileImageAlt', { name: child.name })}
              className="size-full object-cover object-top"
            />
          ) : (
            <UserRound className="size-7 text-muted-foreground" aria-hidden="true" />
          )}
        </span>
        <div className="grid min-w-0 gap-0.5">
          <p className="truncate font-serif text-xl font-semibold">{child.name}</p>
          {facts.length > 0 && <p className="text-sm text-muted-foreground">{facts.join(' · ')}</p>}
        </div>
      </div>
      {child.likes.length > 0 && (
        <ul aria-label={tLib('characters.likes')} className="flex flex-wrap gap-1.5">
          {child.likes.slice(0, 6).map((like) => (
            <li
              key={like}
              className="rounded-full bg-[#e4f3ef] px-2.5 py-0.5 text-[0.8rem] font-bold text-[#2f6f66]"
            >
              {like}
            </li>
          ))}
        </ul>
      )}
      {confirming ? (
        <div
          role="alertdialog"
          aria-label={tChildren('confirm', { name: child.name })}
          className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3 text-sm"
        >
          <span className="flex-1">{tChildren('confirm', { name: child.name })}</span>
          <Button size="sm" variant="destructive" disabled={busy} onClick={onDelete}>
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            {tChildren('confirmDelete')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setConfirming(false);
            }}
          >
            {tChildren('cancel')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            data-track="crear-con-personaje"
            onClick={() => {
              createWith(child.id);
            }}
          >
            {tLib('createWith', { name: child.name })}
          </Button>
          <Link href={profileHref} className={buttonVariants({ size: 'sm', variant: 'ghost' })}>
            {t('profileOpen')}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto"
            aria-label={tLib('characters.delete', { name: child.name })}
            onClick={() => {
              setConfirming(true);
            }}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      )}
    </li>
  );
}

/** Los personajes de la cuenta, con la tarjeta para agregar a otro chico. */
export function CharactersPanel({
  characters,
  onDeleted,
}: {
  characters: ChildSummary[];
  onDeleted: () => void;
}) {
  const t = useTranslations('Account.myStories');
  const tLib = useTranslations('Account.myStories.library');
  const tChildren = useTranslations('Account.children');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function remove(child: ChildSummary) {
    setBusy(child.id);
    setMessage(null);
    try {
      const result = await api('deleteChild', { params: { childId: child.id } });
      // Los borradores del chico se borraron en el servidor: lo que quedó escrito acá también.
      clearStepDrafts();
      setMessage({
        text:
          result.keptOrderedBooks > 0
            ? tChildren('deletedKept', { name: child.name, count: result.keptOrderedBooks })
            : tChildren('deleted', { name: child.name }),
        error: false,
      });
      onDeleted();
    } catch (caught) {
      setMessage({
        text: caught instanceof ApiError ? caught.message : tChildren('error'),
        error: true,
      });
    } finally {
      setBusy(null);
    }
  }

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
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {characters.map((child) => (
          <CharacterCard
            key={child.id}
            child={child}
            busy={busy === child.id}
            onDelete={() => void remove(child)}
          />
        ))}
        <li>
          <Link
            href={{ pathname: '/create', query: { line: 'families' } }}
            className="grid h-full min-h-44 place-items-center content-center gap-2 rounded-2xl border-2 border-dashed border-navy/25 p-6 text-center transition-colors hover:border-navy hover:bg-card"
          >
            <span className="grid size-12 place-items-center rounded-full bg-muted">
              <Plus className="size-6 text-foreground" aria-hidden="true" />
            </span>
            <span className="font-bold">{tLib('characters.add')}</span>
            <span className="text-sm text-muted-foreground">{tLib('characters.addText')}</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
