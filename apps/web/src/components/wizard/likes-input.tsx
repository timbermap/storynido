'use client';

import { CHILD_LIMITS } from '@storynido/shared';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';

/** Lo que tiene escrito y todavía no agregó: se suma al guardar (no se pierde). */
export function withPendingLike(likes: string[], like: string): string[] {
  const value = like.trim().slice(0, CHILD_LIMITS.likeMaxLength);
  return value && !likes.includes(value)
    ? [...likes, value].slice(0, CHILD_LIMITS.maxLikes)
    : likes;
}

/**
 * «¿Qué le gusta?»: chips que se agregan con Enter, coma o «Agregar» y se quitan con la cruz
 * (hasta CHILD_LIMITS.maxLikes). Lo mismo en el creador y en «Agregar a otro chico».
 */
export function LikesInput({
  id,
  label,
  hint,
  likes,
  onLikes,
  like,
  onLike,
  labelClassName,
  inputClassName,
}: {
  id: string;
  label: string;
  hint: string;
  likes: string[];
  onLikes: (likes: string[]) => void;
  /** El texto que se está escribiendo. */
  like: string;
  onLike: (like: string) => void;
  labelClassName: string;
  inputClassName: string;
}) {
  const t = useTranslations('Wizard.child');

  function add() {
    onLikes(withPendingLike(likes, like));
    onLike('');
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add();
    }
  }

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {hint}
      </p>
      {likes.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {likes.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-1 rounded-full border bg-card py-1 pr-1 pl-3 text-sm font-bold text-foreground"
            >
              {item}
              <button
                type="button"
                className="grid size-6 place-items-center rounded-full hover:bg-primary/10"
                aria-label={t('removeLike', { like: item })}
                onClick={() => {
                  onLikes(likes.filter((l) => l !== item));
                }}
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          className={inputClassName}
          value={like}
          aria-describedby={`${id}-hint`}
          disabled={likes.length >= CHILD_LIMITS.maxLikes}
          maxLength={CHILD_LIMITS.likeMaxLength}
          placeholder={t('likesPlaceholder')}
          onChange={(event) => {
            onLike(event.target.value);
          }}
          onKeyDown={onKey}
        />
        <Button type="button" variant="outline" onClick={add} disabled={!like.trim()}>
          {t('addLike')}
        </Button>
      </div>
    </div>
  );
}
