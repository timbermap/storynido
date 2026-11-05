'use client';

import { Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button, buttonVariants } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { isCreatorDraftEmpty, registerCreatorExit } from '@/lib/creator-exit';
import { clearStepDrafts } from '@/lib/use-step-draft';
import { cn } from '@/lib/utils';

/**
 * «Guardar y salir» de un borrador guardado: un diálogo en el centro de la pantalla con seguir
 * creando, salir guardando o descartar el cuento (con confirmación; borra el borrador y las fotos
 * subidas en él). Se monta en `body`: dentro del encabezado (que tiene `backdrop-blur`) el `fixed`
 * quedaba pegado arriba y el fondo oscuro tapaba solo el encabezado.
 */
export function ExitCreator({ bookId }: { bookId: string }) {
  const t = useTranslations('Nav');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    dialog.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    // Sin scroll de la página mientras el diálogo está abierto.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, busy]);

  // Abre el diálogo; un borrador sin nada escrito sale directo (no hay nada que guardar ni perder).
  const requestExit = useCallback(() => {
    if (isCreatorDraftEmpty(bookId)) {
      router.push('/my-stories');
      return;
    }
    setOpen(true);
    setConfirming(false);
    setFailed(false);
  }, [bookId, router]);
  // El «atrás» del navegador en el primer paso pide salir igual que la X.
  useEffect(() => registerCreatorExit(requestExit), [requestExit]);

  const close = () => {
    if (!busy) setOpen(false);
  };

  async function discard() {
    setBusy(true);
    setFailed(false);
    try {
      await api('deleteDraft', { params: { bookId } });
      clearStepDrafts(bookId);
      router.push('/my-stories');
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={requestExit}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-foreground/80 hover:text-primary"
      >
        {/* Una X (salir del creador), no una flecha: «Volver» al paso anterior está abajo. */}
        <X className="size-4" aria-hidden="true" />
        {t('saveAndExit')}
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-navy/40 p-4 backdrop-blur-[2px]"
            onClick={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <div
              ref={dialog}
              role={confirming ? 'alertdialog' : 'dialog'}
              aria-modal="true"
              aria-labelledby="exit-creator-title"
              tabIndex={-1}
              className="relative grid w-full max-w-md gap-5 rounded-2xl bg-card p-6 shadow-[var(--shadow-card)] outline-none sm:p-7"
            >
              <button
                type="button"
                onClick={close}
                aria-label={t('close')}
                className="absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
              {!confirming ? (
                <>
                  <div className="pr-8">
                    <h2 id="exit-creator-title" className="text-xl font-medium">
                      {t('exitTitle')}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">{t('exitText')}</p>
                  </div>
                  {/* Salir es lo que vino a hacer (principal); seguir creando, al lado. */}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Link href="/my-stories" className={buttonVariants({ size: 'lg' })}>
                      {t('saveAndExit')}
                    </Link>
                    <Button size="lg" variant="outline" onClick={close}>
                      {t('keepCreating')}
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirming(true);
                    }}
                    className="inline-flex min-h-11 items-center justify-center border-t pt-4 text-sm font-semibold text-destructive underline-offset-4 hover:underline"
                  >
                    {t('discard')}
                  </button>
                </>
              ) : (
                <>
                  <p id="exit-creator-title" className="pr-8 font-semibold">
                    {t('discardConfirm')}
                  </p>
                  {failed && (
                    <p role="alert" className="text-sm font-semibold text-destructive">
                      {t('discardError')}
                    </p>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button variant="destructive" disabled={busy} onClick={() => void discard()}>
                      {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                      {t('discardYes')}
                    </Button>
                    <Button
                      variant="ghost"
                      className={cn(busy && 'pointer-events-none')}
                      onClick={() => {
                        setConfirming(false);
                      }}
                    >
                      {t('cancel')}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
