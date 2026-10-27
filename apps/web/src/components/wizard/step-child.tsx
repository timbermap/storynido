'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type KeyboardEvent } from 'react';

import { CHILD_LIMITS, type Child } from '@storynido/shared';

import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { getFirebaseDb } from '@/lib/firebase/client';
import { saveChild, updateBook } from '@/lib/firebase/drafts';
import { useStepDraft } from '@/lib/use-step-draft';

import type { StepNav, WizardData } from './types';
import { WizardShell } from './wizard-shell';

const inputClass =
  'h-12 w-full rounded-[0.75rem] border-[1.5px] border-[#b9acbf] bg-card px-3.5 text-base text-foreground placeholder:text-[#756b80] focus:border-primary focus:outline-3 focus:outline-offset-1 focus:outline-[#d8c1f2]';
const labelClass = 'text-[0.91rem] font-semibold';

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
  const [error, setError] = useState<string | null>(null);
  const clearDraft = useStepDraft(
    book.id,
    'child',
    { name, age, pronouns, likes, like, petName, friend, dedication },
    (saved) => {
      setName(saved.name);
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
      setError(t('required'));
      return;
    }
    setError(null);
    const pending = like.trim() ? [...likes, like.trim()].slice(0, CHILD_LIMITS.maxLikes) : likes;
    const ok = await nav.save(async () => {
      const db = await getFirebaseDb();
      await saveChild(db, user.uid, book.id, book.childId, {
        name: name.trim().slice(0, CHILD_LIMITS.nameMaxLength),
        age,
        pronouns,
        likes: pending,
        petName: blankToNull(petName),
        bestFriendName: blankToNull(friend),
      });
      await updateBook(db, book.id, { dedication: blankToNull(dedication) });
    });
    if (ok) {
      clearDraft();
      await nav.goNext();
    }
  }

  return (
    <WizardShell
      {...nav}
      title={t('title')}
      subtitle={t('subtitle')}
      error={error}
      onNext={() => void next()}
    >
      <div className="grid gap-6">
        <div className="grid gap-6 sm:grid-cols-[2fr_1fr]">
          <div className="grid gap-2">
            <label htmlFor="child-name" className={labelClass}>
              {t('name')}
            </label>
            <input
              id="child-name"
              className={inputClass}
              value={name}
              maxLength={CHILD_LIMITS.nameMaxLength}
              autoComplete="off"
              placeholder={t('namePlaceholder')}
              aria-invalid={error ? true : undefined}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="child-age" className={labelClass}>
              {t('age')}
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
                className="flex cursor-pointer items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-bold has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
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
                  className="inline-flex items-center gap-1 rounded-full bg-secondary py-1 pr-1 pl-3 text-sm font-bold text-primary"
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
      </div>
    </WizardShell>
  );
}
