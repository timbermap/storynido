'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { CHILD_LIMITS, EMPTY_BIRTHDAY, turningAgeFor, type Child } from '@storynido/shared';

import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { takeReuseCharacter } from '@/lib/reuse-character';
import { getFirebaseDb } from '@/lib/firebase/client';
import {
  listSavedCharacters,
  saveChild,
  updateBook,
  type SavedCharacter,
} from '@/lib/firebase/drafts';
import { cn } from '@/lib/utils';
import { useStepDraft } from '@/lib/use-step-draft';

import type { StepNav, WizardData } from './types';
import { WizardShell } from './wizard-shell';

export const inputClass =
  'h-12 w-full rounded-[0.75rem] border-[1.5px] border-[#b7bcc8] bg-card px-3.5 text-base text-foreground placeholder:text-[#555c6e] focus:border-primary focus:outline-3 focus:outline-offset-1 focus:outline-[#d9cef0]';
export const labelClass = 'text-[0.91rem] font-semibold';

const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim());

export function StepChild({ nav, data }: { nav: StepNav; data: WizardData }) {
  const t = useTranslations('Wizard.child');
  const { user } = useAuth();
  const { book, child } = data;

  const [name, setName] = useState(child?.name ?? '');
  const [age, setAge] = useState(child?.age ?? 5);
  const [pronouns, setPronouns] = useState<Child['pronouns']>(child?.pronouns ?? null);
  const [likes, setLikes] = useState<string[]>(child?.likes ?? []);
  const [like, setLike] = useState('');
  const [petName, setPetName] = useState(child?.petName ?? '');
  const [friend, setFriend] = useState(child?.bestFriendName ?? '');
  const [dedication, setDedication] = useState(book.dedication ?? '');
  // Protagonistas ya creados: en un borrador sin protagonista se ofrecen para reutilizar.
  const [saved, setSaved] = useState<SavedCharacter[]>([]);
  const [reuse, setReuse] = useState<SavedCharacter | null>(null);

  function pick(character: SavedCharacter | null) {
    setReuse(character);
    const fields = character?.fields;
    setName(fields?.name ?? '');
    setAge(fields?.age ?? 5);
    setPronouns(fields?.pronouns ?? null);
    setLikes(fields?.likes ?? []);
    setPetName(fields?.petName ?? '');
    setFriend(fields?.bestFriendName ?? '');
    setAlias(fields?.alias ?? '');
  }
  // Profesionales: el alias identifica el proyecto en la cuenta; el nombre es el del cuento.
  const isPro = book.channel === 'professionals';
  const [alias, setAlias] = useState(child?.alias ?? '');
  useEffect(() => {
    if (!user || book.childId) return;
    void getFirebaseDb()
      .then((db) => listSavedCharacters(db, user.uid))
      .then((found) => {
        setSaved(found);
        // Viene del perfil de un personaje ("Crear un cuento con…"): queda elegido.
        const wanted = takeReuseCharacter();
        const match = found.find((character) => character.id === wanted);
        if (match) pick(match);
      })
      .catch(() => undefined);
  }, [user, book.childId]);
  // Celebraciones: acá solo quién cumple; la fiesta y lo que se lleva tienen sus propias pantallas.
  const isEvent = book.channel === 'events';
  const [error, setError] = useState<string | null>(null);
  // El error del nombre va junto al campo, que recibe el foco (auditoría UX).
  const [nameError, setNameError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const clearDraft = useStepDraft(
    book.id,
    'child',
    {
      name,
      alias,
      age,
      pronouns,
      likes,
      like,
      petName,
      friend,
      dedication,
    },
    (saved) => {
      setName(saved.name);
      setAlias(saved.alias);
      setAge(saved.age);
      setPronouns(saved.pronouns);
      setLikes(saved.likes);
      setLike(saved.like);
      setPetName(saved.petName);
      setFriend(saved.friend);
      setDedication(saved.dedication);
    },
  );

  const pronounOptions: { value: Child['pronouns']; label: string }[] = [
    { value: 'she', label: t('she') },
    { value: 'he', label: t('he') },
    { value: null, label: t('they') },
  ];

  function addLike() {
    const value = like.trim().slice(0, CHILD_LIMITS.likeMaxLength);
    if (value && likes.length < CHILD_LIMITS.maxLikes && !likes.includes(value))
      setLikes([...likes, value]);
    setLike('');
  }

  function onLikeKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addLike();
    }
  }

  async function next() {
    if (!user) return;
    if (name.trim() === '') {
      setNameError(t('required'));
      nameRef.current?.focus();
      return;
    }
    setNameError(null);
    setError(null);
    const pending = like.trim() ? [...likes, like.trim()].slice(0, CHILD_LIMITS.maxLikes) : likes;
    const ok = await nav.save(async () => {
      const db = await getFirebaseDb();
      // Primer guardado real: si el borrador estaba en memoria, se crea ahora.
      const id = await nav.ensureBook();
      const childId = await saveChild(db, user.uid, id, book.childId ?? reuse?.id ?? null, {
        name: name.trim().slice(0, CHILD_LIMITS.nameMaxLength),
        age,
        pronouns,
        likes: pending,
        petName: blankToNull(petName),
        bestFriendName: blankToNull(friend),
        ...(isPro ? { alias: blankToNull(alias.slice(0, CHILD_LIMITS.nameMaxLength)) } : {}),
      });
      await updateBook(db, id, {
        // Reutilizado: el libro queda con ese protagonista y su aspecto del último cuento
        // (rasgos o fotos vigentes); la lámina se vuelve a aprobar en la muestra.
        ...(reuse ? { childId, ...(reuse.look ?? {}) } : {}),
        ...(isEvent
          ? {
              // La edad que se pide es la que cumple: no se pregunta dos veces.
              event: {
                ...EMPTY_BIRTHDAY,
                ...book.event,
                turningAge: turningAgeFor(book.event?.type ?? 'birthday', age),
              },
            }
          : { dedication: isPro ? null : blankToNull(dedication) }),
      });
    });
    if (ok) {
      clearDraft();
      await nav.goNext();
    }
  }

  return (
    <WizardShell
      {...nav}
      title={isEvent ? t('event.stepTitle') : t('title')}
      subtitle={isEvent ? t('event.stepSubtitle') : t('subtitle')}
      error={error}
      onNext={() => void next()}
    >
      <div className="grid gap-6">
        {saved.length > 0 && (
          <fieldset className="grid gap-2">
            <legend className="mb-1 font-semibold">{t('reuseTitle')}</legend>
            <div className="flex flex-wrap gap-2">
              {[...saved, null].map((character) => {
                const active = reuse?.id === character?.id || (!reuse && !character);
                return (
                  <label
                    key={character?.id ?? 'new'}
                    className={cn(
                      'inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 px-4 text-sm font-semibold transition has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                      active ? 'border-navy bg-card' : 'border-border hover:border-primary/40',
                    )}
                  >
                    <input
                      type="radio"
                      name="reuse"
                      className="sr-only"
                      checked={active}
                      onChange={() => {
                        pick(character);
                      }}
                    />
                    {character
                      ? isPro && character.fields.alias
                        ? character.fields.alias
                        : character.fields.name
                      : t('reuseNew')}
                  </label>
                );
              })}
            </div>
            {reuse && (
              <p className="text-sm text-muted-foreground">
                {reuse.look ? t('reuseLook') : t('reuseNoLook')}
              </p>
            )}
          </fieldset>
        )}
        {isPro && (
          <div className="grid gap-2">
            <label htmlFor="child-alias" className={labelClass}>
              {t('pro.alias')}
            </label>
            <p id="alias-hint" className="text-sm text-muted-foreground">
              {t('pro.aliasHint')}
            </p>
            <input
              id="child-alias"
              className={inputClass}
              value={alias}
              maxLength={CHILD_LIMITS.nameMaxLength}
              autoComplete="off"
              aria-describedby="alias-hint"
              placeholder={t('pro.aliasPlaceholder')}
              onChange={(event) => {
                setAlias(event.target.value);
              }}
            />
          </div>
        )}
        <div className="grid gap-6 sm:grid-cols-[2fr_1fr]">
          <div className="grid gap-2">
            <label htmlFor="child-name" className={labelClass}>
              {isPro ? t('pro.storyName') : t('name')}
            </label>
            <input
              id="child-name"
              ref={nameRef}
              className={cn(inputClass, nameError && 'border-red-700')}
              value={name}
              maxLength={CHILD_LIMITS.nameMaxLength}
              autoComplete="off"
              placeholder={t('namePlaceholder')}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? 'child-name-error' : undefined}
              onChange={(event) => {
                setName(event.target.value);
                if (nameError && event.target.value.trim()) setNameError(null);
              }}
            />
            {nameError && (
              <p id="child-name-error" role="alert" className="text-sm font-bold text-red-800">
                {nameError}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <label htmlFor="child-age" className={labelClass}>
              {/* En un cumpleaños la única edad que se pide es la que cumple. */}
              {isEvent && (book.event?.type ?? 'birthday') === 'birthday'
                ? t('event.turningAge')
                : t('age')}
            </label>
            <select
              id="child-age"
              className={inputClass}
              value={age}
              onChange={(event) => {
                setAge(Number(event.target.value));
              }}
            >
              {Array.from({ length: CHILD_LIMITS.maxAge + 1 }, (_, value) => (
                <option key={value} value={value}>
                  {t('ageOption', { age: value })}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="grid gap-2">
          <legend className={labelClass}>{t('pronouns')}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {pronounOptions.map(({ value, label }) => (
              <label
                key={value ?? 'none'}
                className="flex cursor-pointer items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-bold has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-white has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
              >
                <input
                  type="radio"
                  name="pronouns"
                  className="sr-only"
                  checked={pronouns === value}
                  onChange={() => {
                    setPronouns(value);
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Celebraciones pregunta lo justo: quien organiza una fiesta tiene apuro. */}
        {!isEvent && (
          <>
            <div className="grid gap-2">
              <label htmlFor="child-like" className={labelClass}>
                {t('likes')}
              </label>
              <p id="likes-hint" className="text-sm text-muted-foreground">
                {t('likesHint')}
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
                          setLikes(likes.filter((l) => l !== item));
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
                  id="child-like"
                  className={inputClass}
                  value={like}
                  aria-describedby="likes-hint"
                  disabled={likes.length >= CHILD_LIMITS.maxLikes}
                  maxLength={CHILD_LIMITS.likeMaxLength}
                  placeholder={t('likesPlaceholder')}
                  onChange={(event) => {
                    setLike(event.target.value);
                  }}
                  onKeyDown={onLikeKey}
                />
                <Button type="button" variant="outline" onClick={addLike} disabled={!like.trim()}>
                  {t('addLike')}
                </Button>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="child-pet" className={labelClass}>
                  {t('pet')}
                </label>
                <input
                  id="child-pet"
                  className={inputClass}
                  value={petName}
                  maxLength={CHILD_LIMITS.nameMaxLength}
                  onChange={(event) => {
                    setPetName(event.target.value);
                  }}
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="child-friend" className={labelClass}>
                  {t('friend')}
                </label>
                <input
                  id="child-friend"
                  className={inputClass}
                  value={friend}
                  maxLength={CHILD_LIMITS.nameMaxLength}
                  onChange={(event) => {
                    setFriend(event.target.value);
                  }}
                />
              </div>
            </div>
          </>
        )}

        {/* Profesionales: sin dedicatoria familiar (el libro es para el trabajo). */}
        {!isPro && !isEvent && (
          <div className="grid gap-2">
            <label htmlFor="child-dedication" className={labelClass}>
              {t('dedication')}
            </label>
            <textarea
              id="child-dedication"
              className={`${inputClass} h-28 py-3`}
              value={dedication}
              maxLength={CHILD_LIMITS.dedicationMaxLength}
              placeholder={t('dedicationPlaceholder')}
              onChange={(event) => {
                setDedication(event.target.value);
              }}
            />
          </div>
        )}
      </div>
    </WizardShell>
  );
}
