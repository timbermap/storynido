'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { clearStepDrafts } from '@/lib/use-step-draft';
import { cn } from '@/lib/utils';

/**
 * «Guardar y salir» de un borrador guardado: un diálogo chico con salir (lo principal) o descartar
 * el cuento (con confirmación; borra el borrador y las fotos subidas en él).
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
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

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
        onClick={() => {
          setOpen(true);
          setConfirming(false);
          setFailed(false);
        }}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-foreground/80 hover:text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('saveAndExit')}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-navy/30 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialog}
            role={confirming ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-labelledby="exit-creator-title"
            tabIndex={-1}
            className="grid w-full max-w-sm gap-4 rounded-2xl bg-card p-6 shadow-[var(--shadow-card)] outline-none"
          >
            {!confirming ? (
              <>
                <div>
                  <h2 id="exit-creator-title" className="text-xl font-medium">
                    {t('exitTitle')}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t('exitText')}</p>
                </div>
                <Link href="/my-stories" className={buttonVariants({ size: 'lg' })}>
                  {t('saveAndExit')}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(true);
                  }}
                  className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-destructive underline-offset-4 hover:underline"
                >
                  {t('discard')}
                </button>
              </>
            ) : (
              <>
                <p id="exit-creator-title" className="font-semibold">
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
        </div>
      )}
    </>
  );
}
