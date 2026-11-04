'use client';

import {
  CHILD_LIMITS,
  COLLECTIONS,
  PHOTO_RULES,
  type Avatar,
  type Locale,
} from '@storynido/shared';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { LikesInput, withPendingLike } from '@/components/wizard/likes-input';
import { AVATAR_TRAITS, TraitPicker, type TraitDraft } from '@/components/wizard/trait-picker';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { acceptedPhotos, uploadChildPhoto } from '@/lib/child-photos';
import { getFirebaseDb } from '@/lib/firebase/client';
import { LEGAL_SLUGS } from '@/lib/legal';
import { cn } from '@/lib/utils';

const field =
  'h-11 w-full rounded-xl border-[1.5px] border-[#b7bcc8] bg-card px-3 text-base focus:border-primary';
const PRONOUNS = ['she', 'he', 'they'] as const;
const AGES = Array.from(
  { length: CHILD_LIMITS.maxAge - CHILD_LIMITS.minAge + 1 },
  (_, index) => CHILD_LIMITS.minAge + index,
);

/**
 * «Agregar a otro chico»: guarda solo el personaje (sin cuento), con su foto (y el consentimiento)
 * o sus rasgos. Después, en su perfil, se crea su dibujo o un cuento con él.
 */
export function NewCharacter() {
  const t = useTranslations('Account.myStories.newCharacter');
  const tChild = useTranslations('Wizard.child');
  const tPhotos = useTranslations('Wizard.photos');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { user, signedIn, loading } = useAuth();
  const [name, setName] = useState('');
  const [age, setAge] = useState(5);
  const [pronouns, setPronouns] = useState<(typeof PRONOUNS)[number] | null>(null);
  const [likes, setLikes] = useState<string[]>([]);
  const [like, setLike] = useState('');
  const [mode, setMode] = useState<'photo' | 'avatar'>('photo');
  const [consent, setConsent] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const photoInput = useRef<HTMLInputElement>(null);
  // Vista previa local de las fotos elegidas (no se suben hasta guardar).
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    const urls = files.map((item) => URL.createObjectURL(item));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviews(urls);
    return () => {
      urls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [files]);
  const slotsLeft = PHOTO_RULES.maxPhotosPerBook - files.length;
  const [traits, setTraits] = useState<TraitDraft>({ glasses: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !signedIn) router.replace('/login');
  }, [loading, signedIn, router]);

  const ready =
    name.trim() !== '' &&
    (mode === 'photo'
      ? consent && files.length > 0
      : AVATAR_TRAITS.every((trait) => Boolean(traits[trait])));

  async function save() {
    if (!user || !ready) return;
    setBusy(true);
    setError(null);
    try {
      const db = await getFirebaseDb();
      const ref = await addDoc(collection(db, COLLECTIONS.children), {
        ownerUid: user.uid,
        name: name.trim().slice(0, CHILD_LIMITS.nameMaxLength),
        age,
        pronouns,
        // Lo que quedó escrito sin agregar también se guarda.
        likes: withPendingLike(likes, like),
        petName: null,
        bestFriendName: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (mode === 'photo' && files.length > 0) {
        // Si alguna foto no sirve, el personaje queda igual: en su perfil se ve y se sube otra.
        for (const photo of files) {
          await uploadChildPhoto(ref.id, photo, locale).catch(() => undefined);
        }
      } else {
        await api('setChildAvatar', {
          params: { childId: ref.id },
          body: { avatar: traits as Avatar },
        });
      }
      router.push({
        pathname: '/my-stories/characters/[childId]',
        params: { childId: ref.id },
      });
    } catch {
      setError(t('error'));
      setBusy(false);
    }
  }

  return (
    <section className="container-page grid max-w-2xl gap-6 py-12">
      <Link
        href={{ pathname: '/my-stories', query: { estado: 'personajes' } }}
        className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
      >
        {t('back')}
      </Link>
      <div>
        <h1 className="text-3xl font-medium sm:text-4xl">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('text')}</p>
      </div>

      <div className="grid gap-5 rounded-2xl border bg-card p-5 sm:p-6">
        <div className="grid gap-2">
          <label htmlFor="new-child-name" className="font-semibold">
            {tChild('name')}
          </label>
          <input
            id="new-child-name"
            className={field}
            value={name}
            maxLength={CHILD_LIMITS.nameMaxLength}
            placeholder={tChild('namePlaceholder')}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
          <div className="grid gap-2">
            <label htmlFor="new-child-age" className="font-semibold">
              {tChild('age')}
            </label>
            <select
              id="new-child-age"
              className={field}
              value={age}
              onChange={(event) => {
                setAge(Number(event.target.value));
              }}
            >
              {AGES.map((value) => (
                <option key={value} value={value}>
                  {tChild('ageOption', { age: value })}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label htmlFor="new-child-pronouns" className="font-semibold">
              {t('pronouns')}
            </label>
            <select
              id="new-child-pronouns"
              className={field}
              value={pronouns ?? ''}
              onChange={(event) => {
                setPronouns((event.target.value || null) as (typeof PRONOUNS)[number] | null);
              }}
            >
              <option value="">—</option>
              {PRONOUNS.map((value) => (
                <option key={value} value={value}>
                  {tChild(value)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <LikesInput
          id="new-child-likes"
          label={tChild('likes')}
          hint={tChild('likesHint')}
          likes={likes}
          onLikes={setLikes}
          like={like}
          onLike={setLike}
          labelClassName="font-semibold"
          inputClassName={field}
        />

        <fieldset className="grid gap-3">
          <legend className="mb-1 font-semibold">{t('looks')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['photo', 'avatar'] as const).map((value) => (
              <label
                key={value}
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-xl border-2 px-4 py-3 font-semibold',
                  mode === value ? 'border-navy' : 'border-border',
                )}
              >
                <input
                  type="radio"
                  name="new-child-mode"
                  className="accent-[var(--primary)]"
                  checked={mode === value}
                  onChange={() => {
                    setMode(value);
                  }}
                />
                {t(value === 'photo' ? 'withPhoto' : 'withoutPhoto')}
              </label>
            ))}
          </div>
        </fieldset>

        {mode === 'photo' ? (
          <div className="grid gap-3">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
                checked={consent}
                onChange={(event) => {
                  setConsent(event.target.checked);
                }}
              />
              <span>
                {tPhotos('consentText')}{' '}
                <Link
                  href={{
                    pathname: '/legal/[document]',
                    params: { document: LEGAL_SLUGS[locale].privacy },
                  }}
                  className="font-bold text-primary underline"
                  target="_blank"
                >
                  {tPhotos('privacy')}
                </Link>
              </span>
            </label>
            <p className="font-semibold">{t('photos')}</p>
            {/* Botón propio (como en el paso de fotos): el del navegador dice «Choose File». */}
            <input
              ref={photoInput}
              id="new-child-photo"
              type="file"
              multiple
              accept={PHOTO_RULES.allowedTypes.join(',')}
              className="sr-only"
              tabIndex={-1}
              disabled={!consent || slotsLeft <= 0}
              onChange={(event) => {
                const chosen = acceptedPhotos(event.target.files);
                event.target.value = '';
                setFiles((current) =>
                  [...current, ...chosen].slice(0, PHOTO_RULES.maxPhotosPerBook),
                );
              }}
            />
            {files.length > 0 && (
              <ul className="grid grid-cols-3 gap-3 sm:max-w-md" aria-live="polite">
                {files.map((item, index) => (
                  <li
                    key={`${item.name}-${String(index)}`}
                    className="relative overflow-hidden rounded-xl border bg-muted"
                  >
                    {previews[index] && (
                      // eslint-disable-next-line @next/next/no-img-element -- URL local de la foto elegida.
                      <img
                        src={previews[index]}
                        alt={t('photoPreview', { number: index + 1 })}
                        className="aspect-square w-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      className="absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-full bg-card/90 text-foreground shadow hover:bg-card"
                      aria-label={t('photoRemove', { number: index + 1 })}
                      onClick={() => {
                        setFiles((current) => current.filter((_, i) => i !== index));
                      }}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              disabled={!consent || slotsLeft <= 0}
              onClick={() => photoInput.current?.click()}
            >
              <ImagePlus aria-hidden="true" />
              {tPhotos('choose')}
            </Button>
            <p className="text-sm text-muted-foreground">
              {slotsLeft <= 0 ? tPhotos('limit') : tPhotos('formats')}. {t('photoNote')}
            </p>
          </div>
        ) : (
          <TraitPicker idPrefix="new-child" value={traits} onChange={setTraits} />
        )}

        {error && (
          <p role="alert" className="font-semibold text-destructive">
            {error}
          </p>
        )}
        <Button size="lg" className="w-fit" disabled={!ready || busy} onClick={() => void save()}>
          {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
          {t('save')}
        </Button>
        <p className="text-sm text-muted-foreground">{t('saveNote')}</p>
      </div>
    </section>
  );
}
