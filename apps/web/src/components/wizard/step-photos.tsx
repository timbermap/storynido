'use client';

import { CheckCircle2, ImagePlus, Loader2, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';

import {
  GUARDIAN_CONSENT_VERSION,
  PHOTO_CONSENT_VERSION,
  PHOTO_RULES,
  type Locale,
  type PublicPhoto,
} from '@storynido/shared';

import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { LEGAL_SLUGS } from '@/lib/legal';

import { CharacterModeChooser } from './character-mode';
import type { StepNav, WizardData } from './types';
import { WizardShell } from './wizard-shell';

interface LocalUpload {
  key: string;
  name: string;
  phase: 'uploading' | 'validating';
}

const CONSENT_KEY = 'storynido:photoConsent';
/** Profesionales: el consentimiento recordado incluye la autorización del tutor. */
const consentKey = (pro: boolean) => (pro ? `${CONSENT_KEY}:pro` : CONSENT_KEY);

function rememberedConsent(uid: string, pro: boolean): string | null {
  try {
    const saved = window.sessionStorage.getItem(consentKey(pro));
    const [owner, version, id] = saved?.split('|') ?? [];
    return owner === uid && version === PHOTO_CONSENT_VERSION && id ? id : null;
  } catch {
    return null;
  }
}

export function StepPhotos({ nav, data }: { nav: StepNav; data: WizardData }) {
  const t = useTranslations('Wizard.photos');
  const locale = useLocale() as Locale;
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PublicPhoto[]>([]);
  const [uploads, setUploads] = useState<LocalUpload[]>([]);
  const [consentId, setConsentId] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [guardianChecked, setGuardianChecked] = useState(false);
  const pro = data.book.channel === 'professionals';
  const [error, setError] = useState<string | null>(null);
  const bookId = data.book.id;

  const refresh = useCallback(async () => {
    setPhotos((await api('bookPhotos', { params: { bookId } })).photos);
  }, [bookId]);

  useEffect(() => {
    if (!user) return;
    // Lectura de sessionStorage y de la API después de montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsentId(rememberedConsent(user.uid, pro));
    refresh().catch(() => {
      setError(t('uploadError'));
    });
  }, [user, refresh, t, pro]);

  const valid = photos.filter((photo) => photo.status === 'valid');
  const rejected = photos.filter((photo) => photo.status === 'rejected');
  const slotsLeft = PHOTO_RULES.maxPhotosPerBook - valid.length - uploads.length;

  async function giveConsent() {
    if (!user) return;
    const { consentId: id } = await api('createConsent', {
      body: { type: 'photo_upload', textVersion: PHOTO_CONSENT_VERSION, locale },
    });
    if (pro) {
      // Profesionales: la foto no es de un hijo propio; queda registrada la autorización.
      await api('createConsent', {
        body: { type: 'guardian_authorization', textVersion: GUARDIAN_CONSENT_VERSION, locale },
      });
    }
    try {
      window.sessionStorage.setItem(consentKey(pro), `${user.uid}|${PHOTO_CONSENT_VERSION}|${id}`);
    } catch {
      // Sin storage se vuelve a pedir el consentimiento en otra sesión.
    }
    setConsentId(id);
  }

  async function uploadOne(file: File, consent: string) {
    const key = `${file.name}-${String(file.lastModified)}-${String(Math.random())}`;
    setUploads((current) => [...current, { key, name: file.name, phase: 'uploading' }]);
    try {
      const { photoId, upload } = await api('createPhoto', {
        body: {
          bookId,
          consentId: consent,
          contentType: file.type as (typeof PHOTO_RULES.allowedTypes)[number],
          sizeBytes: file.size,
        },
      });
      const put = await fetch(upload.url, { method: 'PUT', headers: upload.headers, body: file });
      if (!put.ok) throw new Error(`Subida fallida (${String(put.status)})`);
      setUploads((current) =>
        current.map((u) => (u.key === key ? { ...u, phase: 'validating' } : u)),
      );
      await api('processPhoto', { params: { photoId } });
    } catch {
      setError(t('uploadError'));
    } finally {
      setUploads((current) => current.filter((u) => u.key !== key));
      await refresh();
    }
  }

  async function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!consentId) return;
    setError(null);
    // Las fotos rechazadas ya se borraron del almacenamiento: se limpian de la lista.
    await Promise.all(
      rejected.map((photo) =>
        api('deletePhoto', { params: { photoId: photo.id } }).catch(() => undefined),
      ),
    );
    const accepted = files.slice(0, Math.max(slotsLeft, 0));
    if (files.length > accepted.length) setError(t('limit'));
    for (const file of accepted) {
      if (!(PHOTO_RULES.allowedTypes as readonly string[]).includes(file.type)) {
        setError(t('badType'));
        continue;
      }
      if (file.size > PHOTO_RULES.maxBytes) {
        setError(t('tooLarge'));
        continue;
      }
      await uploadOne(file, consentId);
    }
  }

  async function remove(photoId: string) {
    await nav.save(async () => {
      await api('deletePhoto', { params: { photoId } });
      await refresh();
    });
  }

  async function next() {
    if (valid.length === 0) {
      setError(t('needOne'));
      return;
    }
    await nav.goNext();
  }

  return (
    <WizardShell
      {...nav}
      title={t('title')}
      subtitle={t('subtitle')}
      error={error}
      onNext={() => void next()}
      nextDisabled={uploads.length > 0}
    >
      <div className="grid gap-6">
        <CharacterModeChooser nav={nav} data={data} />
        <div className="rounded-xl bg-mint p-5">
          <p className="font-semibold text-success">{t('tipsTitle')}</p>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {(['tip1', 'tip2', 'tip3', 'tip4'] as const).map((tip) => (
              <li key={tip} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
                {t(tip)}
              </li>
            ))}
          </ul>
        </div>

        {!consentId ? (
          <div className="rounded-xl border-2 border-primary/30 p-5">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
              {t('consentTitle')}
            </p>
            <label className="mt-3 flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
                checked={consentChecked}
                onChange={(event) => {
                  setConsentChecked(event.target.checked);
                }}
              />
              <span>
                {t('consentText')}{' '}
                <Link
                  href={{
                    pathname: '/legal/[document]',
                    params: { document: LEGAL_SLUGS[locale].privacy },
                  }}
                  className="font-bold text-primary underline"
                  target="_blank"
                >
                  {t('privacy')}
                </Link>
              </span>
            </label>
            {pro && (
              <label className="mt-3 flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
                  checked={guardianChecked}
                  onChange={(event) => {
                    setGuardianChecked(event.target.checked);
                  }}
                />
                <span>{t('guardianText')}</span>
              </label>
            )}
            <Button
              className="mt-4"
              disabled={!consentChecked || (pro && !guardianChecked)}
              onClick={() =>
                void giveConsent().catch(() => {
                  setError(t('uploadError'));
                })
              }
            >
              {t('accept')}
            </Button>
          </div>
        ) : (
          <div>
            <input
              ref={inputRef}
              id="photo-input"
              type="file"
              accept={PHOTO_RULES.allowedTypes.join(',')}
              multiple
              className="sr-only"
              onChange={(event) => void onFiles(event)}
              disabled={slotsLeft <= 0}
            />
            <Button
              size="lg"
              variant="outline"
              disabled={slotsLeft <= 0}
              onClick={() => inputRef.current?.click()}
              aria-describedby="photo-formats"
            >
              <ImagePlus aria-hidden="true" />
              {t('choose')}
            </Button>
            <p id="photo-formats" className="mt-2 text-sm text-muted-foreground">
              {slotsLeft <= 0 ? t('limit') : t('formats')}
            </p>
          </div>
        )}

        {(photos.length > 0 || uploads.length > 0) && (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {valid.map((photo, index) => (
              <li key={photo.id} className="overflow-hidden rounded-xl border bg-card">
                {photo.previewUrl && (
                  // URL firmada de corta duración: se muestra tal cual.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.previewUrl}
                    alt={t('preview', { number: index + 1 })}
                    className="aspect-square w-full object-cover"
                  />
                )}
                <div className="flex items-center justify-between gap-2 p-3 text-sm font-bold">
                  <span className="inline-flex items-center gap-1.5 text-success">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    {t('valid')}
                  </span>
                  <button
                    type="button"
                    className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`${t('remove')} ${String(index + 1)}`}
                    onClick={() => void remove(photo.id)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
            {uploads.map((upload) => (
              <li
                key={upload.key}
                className="grid aspect-square place-items-center rounded-xl border bg-muted p-3 text-center text-sm font-bold"
                role="status"
              >
                <span className="grid justify-items-center gap-2">
                  <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
                  {upload.phase === 'uploading' ? t('uploading') : t('validating')}
                </span>
              </li>
            ))}
          </ul>
        )}

        {rejected.length > 0 && (
          <ul className="grid gap-2" aria-live="polite">
            {rejected.map((photo) => (
              <li key={photo.id} className="flex items-start gap-2 rounded-xl bg-rose p-4 text-sm">
                <XCircle className="mt-0.5 size-4 shrink-0 text-red-800" aria-hidden="true" />
                <span>
                  <strong>{t('rejected')}:</strong>{' '}
                  {photo.rejectionReasons.map((reason) => t(`reasons.${reason}`)).join(' ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </WizardShell>
  );
}
