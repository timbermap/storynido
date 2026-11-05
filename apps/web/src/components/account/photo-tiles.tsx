'use client';

import { PHOTO_RULES, type Locale } from '@storynido/shared';
import { Loader2, Plus, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { acceptedPhotos } from '@/lib/child-photos';
import { LEGAL_SLUGS } from '@/lib/legal';

export interface PhotoTile {
  key: string;
  url: string | undefined;
  alt: string;
  removeLabel: string;
}

/**
 * Fotos del personaje como miniaturas cuadradas con su X, y una baldosa «+ Agregar foto» mientras
 * haya lugar. El consentimiento se pide al tocar la baldosa (una vez), en un diálogo chico: la
 * tarjeta no muestra el checkbox si no se va a subir nada. Lo usan el perfil y «Agregar a otro chico».
 */
export function PhotoTiles({
  inputId,
  tiles,
  slots,
  busy = false,
  consented,
  onConsent,
  onFiles,
  onRemove,
  confirmRemove,
}: {
  inputId: string;
  tiles: PhotoTile[];
  /** Cuántas fotos más se pueden agregar. */
  slots: number;
  busy?: boolean;
  consented: boolean;
  onConsent: () => void;
  onFiles: (files: File[]) => void;
  onRemove: (index: number) => void;
  /** Texto de confirmación antes de quitar (fotos ya guardadas); sin él, se quita directo. */
  confirmRemove?: string;
}) {
  const t = useTranslations('Account.myStories.photoTiles');
  const tPhotos = useTranslations('Wizard.photos');
  const locale = useLocale() as Locale;
  const input = useRef<HTMLInputElement>(null);
  const [asking, setAsking] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  function add() {
    if (consented) input.current?.click();
    else setAsking(true);
  }

  return (
    <div className="grid gap-3">
      <input
        ref={input}
        id={inputId}
        type="file"
        multiple
        accept={PHOTO_RULES.allowedTypes.join(',')}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const chosen = acceptedPhotos(event.target.files).slice(0, slots);
          event.target.value = '';
          if (chosen.length > 0) onFiles(chosen);
        }}
      />
      <ul className="grid grid-cols-3 gap-3 sm:flex sm:flex-wrap" aria-live="polite">
        {tiles.map((tile, index) => (
          <li
            key={tile.key}
            className="relative aspect-square overflow-hidden rounded-xl border bg-muted sm:w-36"
          >
            {tile.url && (
              // eslint-disable-next-line @next/next/no-img-element -- URL firmada o local.
              <img src={tile.url} alt={tile.alt} className="size-full object-cover" />
            )}
            <button
              type="button"
              disabled={busy}
              className="absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-full bg-card/90 text-foreground shadow hover:bg-card"
              aria-label={tile.removeLabel}
              onClick={() => {
                if (confirmRemove) setRemoving(index);
                else onRemove(index);
              }}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
        {slots > 0 && (
          <li className="aspect-square sm:w-36">
            <button
              type="button"
              disabled={busy}
              onClick={add}
              className="grid size-full place-content-center justify-items-center gap-1.5 rounded-xl border-2 border-dashed border-[#b7bcc8] bg-card p-2 text-center text-sm font-bold text-foreground hover:border-primary hover:bg-muted/40 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="size-6 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-6" aria-hidden="true" />
              )}
              {busy ? t('uploading') : t('add')}
            </button>
          </li>
        )}
      </ul>

      {asking && (
        <SmallDialog
          title={t('consentTitle')}
          onClose={() => {
            setAsking(false);
          }}
        >
          <p className="text-sm">
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
          </p>
          <p className="text-sm text-muted-foreground">{t('tips')}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                onConsent();
                setAsking(false);
                input.current?.click();
              }}
            >
              {t('accept')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAsking(false);
              }}
            >
              {t('cancel')}
            </Button>
          </div>
        </SmallDialog>
      )}

      {removing !== null && confirmRemove && (
        <SmallDialog
          title={confirmRemove}
          onClose={() => {
            setRemoving(null);
          }}
        >
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onRemove(removing);
                setRemoving(null);
              }}
            >
              {t('remove')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRemoving(null);
              }}
            >
              {t('cancel')}
            </Button>
          </div>
        </SmallDialog>
      )}
    </div>
  );
}

/** Diálogo modal chico (nativo: foco, Escape y fondo los maneja el navegador). */
export function SmallDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <dialog
      ref={(node) => {
        if (node && !node.open) node.showModal();
      }}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border bg-card p-0 text-foreground shadow-xl backdrop:bg-navy/40"
    >
      <div className="grid gap-4 p-5">
        <p className="text-lg font-medium">{title}</p>
        {children}
      </div>
    </dialog>
  );
}
