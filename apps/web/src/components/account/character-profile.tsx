'use client';

import { ApiError, CHILD_LIMITS } from '@storynido/shared';
import { Loader2, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { Button, buttonVariants } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { getChildDetails, updateChildDetails, type ChildDetails } from '@/lib/firebase/account';
import { getFirebaseDb } from '@/lib/firebase/client';
import { REUSE_CHARACTER_KEY } from '@/lib/reuse-character';

type Profile = Awaited<ReturnType<typeof loadProfile>>;

const loadProfile = (childId: string) => api('getChildProfile', { params: { childId } });

const field =
  'h-11 w-full rounded-xl border-[1.5px] border-[#b7bcc8] bg-card px-3 text-base focus:border-primary';
const blankToNull = (value: string | null) => (value?.trim() ? value.trim() : null);
const PRONOUNS = ['she', 'he', 'they'] as const;

/**
 * Perfil del personaje (DECISIONS 188): el dibujo aprobado y los datos se conservan; la foto se
 * borra a los 30 días o antes, a pedido. Desde acá se crea un cuento con sus datos ya cargados.
 */
export function CharacterProfile({ childId }: { childId: string }) {
  const t = useTranslations('Account.myStories');
  const date = new Intl.DateTimeFormat(useLocale(), { dateStyle: 'long' });
  const router = useRouter();
  const { signedIn, loading } = useAuth();
  const [details, setDetails] = useState<ChildDetails | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [likes, setLikes] = useState('');
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (!loading && !signedIn) router.replace('/login');
  }, [loading, signedIn, router]);

  useEffect(() => {
    if (!signedIn) return;
    void getFirebaseDb()
      .then((db) => getChildDetails(db, childId))
      .then((found) => {
        setDetails(found);
        setLikes(found?.likes.join(', ') ?? '');
      })
      .catch(() => {
        setFailed(true);
      });
    void loadProfile(childId)
      .then(setProfile)
      .catch(() => {
        setFailed(true);
      });
  }, [signedIn, childId]);

  if (failed || details === null) {
    return (
      <section className="container-page grid max-w-3xl gap-4 py-12">
        <p role="alert" className="rounded-xl bg-muted p-4">
          {failed ? t('profileLoadError') : t('profileMissing')}
        </p>
        <Link href="/my-stories" className="font-semibold text-primary underline-offset-4">
          {t('profileBack')}
        </Link>
      </section>
    );
  }
  if (!details || !profile) {
    return (
      <section className="container-page max-w-3xl py-12">
        <p role="status" className="text-muted-foreground">
          {t('loading')}
        </p>
      </section>
    );
  }

  const name = details.name;

  async function save() {
    if (!details || details.name.trim() === '') return;
    setSaving(true);
    setMessage(null);
    const list = likes
      .split(',')
      .map((like) => like.trim().slice(0, CHILD_LIMITS.likeMaxLength))
      .filter(Boolean)
      .slice(0, CHILD_LIMITS.maxLikes);
    const next: ChildDetails = {
      ...details,
      name: details.name.trim().slice(0, CHILD_LIMITS.nameMaxLength),
      likes: list,
      petName: blankToNull(details.petName),
      bestFriendName: blankToNull(details.bestFriendName),
    };
    try {
      await updateChildDetails(await getFirebaseDb(), childId, next);
      setDetails(next);
      setLikes(list.join(', '));
      setMessage({ text: t('profileSaved', { name: next.name }), error: false });
    } catch {
      setMessage({ text: t('profileSaveError'), error: true });
    } finally {
      setSaving(false);
    }
  }

  async function deletePhotos() {
    setBusy(true);
    setMessage(null);
    try {
      await api('deleteChildPhotos', { params: { childId } });
      setProfile((current) =>
        current ? { ...current, photos: 0, photosExpireAt: null, photoUrls: [] } : current,
      );
      setMessage({ text: t('profilePhotoDeleted', { name }), error: false });
    } catch (caught) {
      setMessage({
        text: caught instanceof ApiError ? caught.message : t('profilePhotoError'),
        error: true,
      });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  function createWith() {
    try {
      sessionStorage.setItem(REUSE_CHARACTER_KEY, childId);
    } catch {
      // Sin almacenamiento, el cuento se crea igual y el personaje se elige en el primer paso.
    }
    router.push({ pathname: '/create', query: { line: 'families' } });
  }

  const statusLabel = (status: Profile['books'][number]['status']) =>
    status === 'ordered'
      ? t('profileBookOrdered')
      : status === 'preview_ready'
        ? t('profileBookReady')
        : t('profileBookDraft');

  return (
    <section className="container-page grid max-w-3xl gap-8 py-12">
      <Link
        href="/my-stories"
        className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
      >
        {t('profileBack')}
      </Link>

      <header className="grid items-center gap-6 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <div className="aspect-[3/4] overflow-hidden rounded-2xl border bg-card">
          {profile.characterImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL firmada de 30 min.
            <img
              src={profile.characterImageUrl}
              alt={t('profileImageAlt', { name })}
              className="size-full object-cover"
            />
          ) : (
            <p className="grid size-full place-items-center p-4 text-center text-sm text-muted-foreground">
              {t('profileNoImage')}
            </p>
          )}
        </div>
        <div className="grid gap-3">
          <h1 className="text-3xl font-medium sm:text-4xl">{name}</h1>
          <p className="text-muted-foreground">{t('charactersAge', { age: details.age })}</p>
          <Button type="button" onClick={createWith} className="w-fit">
            {t('profileCreate', { name })}
          </Button>
          <p className="text-sm text-muted-foreground">{t('profileCreateNote')}</p>
        </div>
      </header>

      {message && (
        <p
          role={message.error ? 'alert' : 'status'}
          className={message.error ? 'font-semibold text-destructive' : 'font-semibold'}
        >
          {message.text}
        </p>
      )}

      <form
        className="grid gap-4 rounded-2xl border bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <h2 className="text-xl font-medium">{t('profileDataTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">{t('characterName')}</span>
            <input
              value={details.name}
              maxLength={CHILD_LIMITS.nameMaxLength}
              required
              onChange={(event) => {
                setDetails({ ...details, name: event.target.value });
              }}
              className={field}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">{t('characterAge')}</span>
            <select
              value={details.age}
              onChange={(event) => {
                setDetails({ ...details, age: Number(event.target.value) });
              }}
              className={field}
            >
              {Array.from({ length: CHILD_LIMITS.maxAge + 1 }, (_, age) => (
                <option key={age} value={age}>
                  {age}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="grid gap-2 text-sm">
          <legend className="mb-1 font-semibold">{t('profilePronouns')}</legend>
          <div className="flex flex-wrap gap-4">
            {PRONOUNS.map((value) => (
              <label key={value} className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name="pronouns"
                  checked={(details.pronouns ?? 'they') === value}
                  onChange={() => {
                    setDetails({ ...details, pronouns: value });
                  }}
                />
                {t(value === 'she' ? 'profileShe' : value === 'he' ? 'profileHe' : 'profileThey')}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">{t('profileLikes')}</span>
          <input
            value={likes}
            onChange={(event) => {
              setLikes(event.target.value);
            }}
            className={field}
            aria-describedby="likes-hint"
          />
          <span id="likes-hint" className="text-xs text-muted-foreground">
            {t('profileLikesHint')}
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">{t('profilePet')}</span>
            <input
              value={details.petName ?? ''}
              maxLength={CHILD_LIMITS.nameMaxLength}
              onChange={(event) => {
                setDetails({ ...details, petName: event.target.value });
              }}
              className={field}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">{t('profileFriend')}</span>
            <input
              value={details.bestFriendName ?? ''}
              maxLength={CHILD_LIMITS.nameMaxLength}
              onChange={(event) => {
                setDetails({ ...details, bestFriendName: event.target.value });
              }}
              className={field}
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{t('characterEditNote')}</p>
        <Button type="submit" disabled={saving} className="w-fit">
          {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
          {t('profileSave')}
        </Button>
      </form>

      <section aria-labelledby="photo-title" className="grid gap-3 rounded-2xl border bg-card p-5">
        <h2 id="photo-title" className="text-xl font-medium">
          {t('profilePhotoTitle')}
        </h2>
        <p>
          {profile.photos > 0 && profile.photosExpireAt
            ? t('profilePhotoSome', {
                count: profile.photos,
                date: date.format(new Date(profile.photosExpireAt)),
              })
            : t('profilePhotoNone')}
        </p>
        {profile.photoUrls.length > 0 && (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {profile.photoUrls.map((url, index) => (
              <li key={url} className="aspect-[3/4] overflow-hidden rounded-xl border">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada de 30 min. */}
                <img
                  src={url}
                  alt={t('profilePhotoAlt', { name, index: index + 1 })}
                  className="size-full object-cover"
                />
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">{t('profilePhotoKeep')}</p>
        {profile.photos > 0 &&
          (confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm">{t('profilePhotoConfirm', { name })}</span>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => void deletePhotos()}
              >
                {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                {t('profilePhotoDelete')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                }}
              >
                {t('profileCancel')}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-fit"
              onClick={() => {
                setConfirming(true);
              }}
            >
              <Trash2 aria-hidden="true" />
              {t('profilePhotoDelete')}
            </Button>
          ))}
      </section>

      <section aria-labelledby="books-title" className="grid gap-3">
        <h2 id="books-title" className="text-xl font-medium">
          {t('profileBooksTitle', { name })}
        </h2>
        {profile.books.length === 0 ? (
          <p className="rounded-xl border bg-card p-5">{t('profileBooksNone')}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {profile.books.map((book) => (
              <li key={book.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                {book.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- URL firmada de 30 min.
                  <img src={book.coverUrl} alt="" className="h-20 w-16 rounded-md object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{book.title ?? t('untitled')}</p>
                  <p className="text-sm text-muted-foreground">{statusLabel(book.status)}</p>
                </div>
                <Link
                  href={{ pathname: '/create/[bookId]', params: { bookId: book.id } }}
                  className={buttonVariants({ size: 'sm', variant: 'outline' })}
                >
                  {t('continue')}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
