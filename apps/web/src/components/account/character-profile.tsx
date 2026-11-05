'use client';

import { ApiError, CHILD_LIMITS, PHOTO_RULES, type Locale } from '@storynido/shared';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { Button, buttonVariants } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { uploadChildPhotos } from '@/lib/child-photos';
import {
  getChildDetails,
  subscribeOrders,
  updateChildDetails,
  type ChildDetails,
  type OrderSummary,
} from '@/lib/firebase/account';
import { getFirebaseDb } from '@/lib/firebase/client';
import { isOrderDone } from '@/lib/order-state';

import { LikesInput, withPendingLike } from '@/components/wizard/likes-input';

import { CharacterDrawing } from './character-drawing';
import { PhotoTiles, SmallDialog } from './photo-tiles';

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
  const tPhotos = useTranslations('Wizard.photos');
  /** «La foto no sirve: …» con los motivos del paso de fotos (cara, luz, nitidez, IA). */
  function rejectedText(reasons: string[]) {
    return [
      t('profilePhotoRejected'),
      ...reasons.map((reason) => tPhotos(`reasons.${reason}` as 'reasons.no_face')),
    ].join(' ');
  }

  const locale = useLocale() as Locale;
  const date = new Intl.DateTimeFormat(useLocale(), { dateStyle: 'long' });
  const router = useRouter();
  const { user, signedIn, loading } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [details, setDetails] = useState<ChildDetails | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [likes, setLikes] = useState<string[]>([]);
  const [like, setLike] = useState('');
  // Fotos desde el perfil (sin cuento): consentimiento y subida.
  const [photoConsent, setPhotoConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [drawingBusy, setDrawingBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (!loading && !signedIn) router.replace('/login');
  }, [loading, signedIn, router]);

  // Viene de «Agregar a otro chico» con fotos que no sirvieron: se avisa con sus motivos.
  const rejectedFromForm = useSearchParams().get('rechazadas');
  useEffect(() => {
    if (!rejectedFromForm) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessage({ text: rejectedText(rejectedFromForm.split(',')), error: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejectedFromForm]);

  useEffect(() => {
    if (!signedIn) return;
    void getFirebaseDb()
      .then((db) => getChildDetails(db, childId))
      .then((found) => {
        setDetails(found);
        setLikes(found?.likes ?? []);
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

  // El estado de cada libro pedido sale de su pedido, igual que en Mis cuentos (un impreso en
  // camino sigue en curso aunque el libro ya esté comprado).
  const uid = signedIn ? (user?.uid ?? null) : null;
  useEffect(() => {
    if (!uid) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void getFirebaseDb().then((db) => {
      if (cancelled) return;
      unsubscribe = subscribeOrders(db, uid, setOrders, () => {
        setOrders([]);
      });
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [uid]);

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

  const photoSlots = Math.max(0, PHOTO_RULES.maxPhotosPerBook - profile.photos);
  // Mientras hay un dibujo nuevo para elegir, el retrato lo muestra (el de ahora queda chico al lado).
  const portraitUrl = profile.drawing.candidateUrl ?? profile.characterImageUrl;

  async function reloadProfile() {
    setProfile(await loadProfile(childId));
  }

  async function addPhotos(chosen: File[]) {
    if (chosen.length === 0) return;
    setUploading(true);
    setMessage(null);
    try {
      const rejected = await uploadChildPhotos(childId, chosen, locale);
      await reloadProfile();
      if (rejected.length > 0) setMessage({ text: rejectedText(rejected), error: true });
    } catch {
      setMessage({ text: t('profilePhotoUploadError'), error: true });
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(photoId: string) {
    setUploading(true);
    setMessage(null);
    try {
      await api('deletePhoto', { params: { photoId } });
      await reloadProfile();
    } catch {
      setMessage({ text: t('profilePhotoError'), error: true });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!details || details.name.trim() === '') return;
    setSaving(true);
    setMessage(null);
    // Lo que quedó escrito sin agregar también se guarda.
    const list = withPendingLike(likes, like);
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
      setLikes(list);
      setLike('');
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
        current
          ? { ...current, photos: 0, validPhotos: 0, photosExpireAt: null, photoUrls: [] }
          : current,
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

  /** «Crear un cuento con…»: se elige qué crear, con el personaje ya elegido. */
  function createWith() {
    router.push({ pathname: '/new', query: { personaje: childId } });
  }

  type ProfileBook = Profile['books'][number];
  // El pedido más reciente de cada libro (los pagos que no se completaron no cuentan).
  const orderOf = (book: ProfileBook) =>
    orders.find(
      (order) =>
        order.bookId === book.id &&
        order.status !== 'pending_payment' &&
        order.status !== 'cancelled',
    );
  const groupOf = (book: ProfileBook): 'creating' | 'inProgress' | 'done' => {
    if (book.status !== 'ordered') return 'creating';
    const order = orderOf(book);
    return order && isOrderDone(order) ? 'done' : 'inProgress';
  };
  const statusLabel = (book: ProfileBook) => {
    const group = groupOf(book);
    if (group === 'done') return t('profileBookDone');
    if (group === 'inProgress') return t('profileBookOrdered');
    return book.status === 'preview_ready' ? t('profileBookReady') : t('profileBookDraft');
  };
  const GROUP_TITLE = {
    creating: 'profileBooksCreating',
    inProgress: 'profileBooksOpen',
    done: 'profileBooksDone',
  } as const;

  return (
    <section className="container-page grid max-w-3xl gap-8 py-12">
      <Link
        href="/my-stories"
        className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
      >
        {t('profileBack')}
      </Link>

      <header className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-4 gap-y-5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-x-8">
        <div
          className={cn(
            'relative aspect-[3/4] overflow-hidden rounded-2xl bg-card sm:row-span-2 sm:self-start',
            profile.drawing.candidateUrl ? 'border-2 border-navy' : 'border',
          )}
        >
          {portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL firmada de 30 min.
            <img
              src={portraitUrl}
              alt={
                profile.drawing.candidateUrl
                  ? t('drawing.newAlt', { name })
                  : t('profileImageAlt', { name })
              }
              className="size-full object-cover"
            />
          ) : (
            <p className="grid size-full place-items-center p-3 text-center text-sm text-muted-foreground">
              {drawingBusy ? (
                <Loader2 className="size-6 animate-spin" aria-hidden="true" />
              ) : (
                t('profileNoDrawing')
              )}
            </p>
          )}
          {profile.drawing.candidateUrl && (
            <span className="absolute top-2 left-2 rounded-full bg-navy px-2.5 py-0.5 text-xs font-bold text-white">
              {t('drawing.new')}
            </span>
          )}
        </div>
        <div className="grid gap-1 sm:self-end">
          <h1 className="text-3xl font-medium sm:text-4xl">{name}</h1>
          <p className="text-muted-foreground">{t('charactersAge', { age: details.age })}</p>
        </div>
        {/* Una sola acción principal según el estado del dibujo (crear, elegir o crear un cuento). */}
        <div className="col-span-2 self-start sm:col-span-1 sm:col-start-2">
          <CharacterDrawing
            childId={childId}
            name={name}
            currentUrl={profile.characterImageUrl}
            drawing={profile.drawing}
            onCreateStory={createWith}
            onBusyChange={setDrawingBusy}
            onChange={({ imageUrl, drawing }) => {
              setProfile((current) =>
                current
                  ? {
                      ...current,
                      characterImageUrl: imageUrl ?? current.characterImageUrl,
                      drawing,
                    }
                  : current,
              );
            }}
          />
        </div>
      </header>

      <section
        id="su-foto"
        aria-labelledby="photo-title"
        className="grid scroll-mt-28 gap-3 rounded-2xl border bg-card p-5"
      >
        <h2 id="photo-title" className="text-xl font-medium">
          {t('profilePhotoTitle', { count: profile.photos })}
        </h2>
        <PhotoTiles
          inputId="profile-photo"
          tiles={profile.photoUrls.map((url, index) => ({
            key: profile.photoIds[index] ?? url,
            url,
            alt: t('profilePhotoAlt', { name, index: index + 1 }),
            removeLabel: t('profilePhotoRemove', { index: index + 1 }),
          }))}
          slots={photoSlots}
          busy={uploading || busy}
          consented={photoConsent}
          onConsent={() => {
            setPhotoConsent(true);
          }}
          onFiles={(chosen) => void addPhotos(chosen)}
          onRemove={(index) => void removePhoto(profile.photoIds[index] ?? '')}
          confirmRemove={t('profilePhotoConfirmOne')}
        />
        <p className="text-sm text-muted-foreground">
          {profile.photos > 0 && profile.photosExpireAt
            ? t('profilePhotoSome', {
                count: profile.photos,
                date: date.format(new Date(profile.photosExpireAt)),
              })
            : t('profilePhotoNone')}
        </p>
        {profile.photos > 1 && (
          <button
            type="button"
            className="w-fit text-sm font-semibold text-primary underline-offset-4 hover:underline"
            onClick={() => {
              setConfirming(true);
            }}
          >
            {t('profilePhotoDeleteAll')}
          </button>
        )}
        {confirming && (
          <SmallDialog
            title={t('profilePhotoConfirm', { name })}
            onClose={() => {
              setConfirming(false);
            }}
          >
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" disabled={busy} onClick={() => void deletePhotos()}>
                {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                {t('profilePhotoDeleteAll')}
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                }}
              >
                {t('profileCancel')}
              </Button>
            </div>
          </SmallDialog>
        )}
      </section>

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
        <LikesInput
          id="profile-likes"
          label={t('profileLikes')}
          hint={t('profileLikesHint')}
          likes={likes}
          onLikes={setLikes}
          like={like}
          onLike={setLike}
          labelClassName="text-sm font-semibold"
          inputClassName={field}
        />
        <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
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

      <section aria-labelledby="books-title" className="grid gap-3">
        <h2 id="books-title" className="text-xl font-medium">
          {t('profileBooksTitle', { name })}
        </h2>
        {profile.books.length === 0 ? (
          <p className="rounded-xl border bg-card p-5">{t('profileBooksNone')}</p>
        ) : (
          // Igual que Mis cuentos: en creación, en curso (pedido sin llegar) y terminados.
          (['creating', 'inProgress', 'done'] as const).map((group) => {
            const books = profile.books.filter((book) => groupOf(book) === group);
            if (books.length === 0) return null;
            return (
              <div key={group} className="grid gap-3">
                <h3 className="text-lg font-medium">
                  {t(GROUP_TITLE[group])} ({books.length})
                </h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {books.map((book) => {
                    const order = orderOf(book);
                    return (
                      <li
                        key={book.id}
                        className="flex items-center gap-3 rounded-xl border bg-card p-3"
                      >
                        {book.coverUrl && (
                          // eslint-disable-next-line @next/next/no-img-element -- URL firmada de 30 min.
                          <img
                            src={book.coverUrl}
                            alt=""
                            className="h-20 w-16 shrink-0 rounded-md object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 font-semibold">
                            {book.title ?? t('untitled')}
                          </p>
                          <p className="text-sm text-muted-foreground">{statusLabel(book)}</p>
                        </div>
                        {group === 'creating' ? (
                          <Link
                            href={{ pathname: '/create/[bookId]', params: { bookId: book.id } }}
                            className={buttonVariants({ size: 'sm', variant: 'outline' })}
                          >
                            {t('continue')}
                          </Link>
                        ) : (
                          <Link
                            href={
                              order
                                ? { pathname: '/order/[orderId]', params: { orderId: order.id } }
                                : {
                                    pathname: '/my-stories',
                                    query: { estado: group === 'done' ? 'terminados' : 'en-curso' },
                                  }
                            }
                            className={buttonVariants({ size: 'sm', variant: 'outline' })}
                          >
                            {t('profileViewOrder')}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </section>
    </section>
  );
}
