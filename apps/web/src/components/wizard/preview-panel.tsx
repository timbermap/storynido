'use client';

import { ApiError, type PublicPreview } from '@storynido/shared';
import { AlertTriangle, Loader2, Pencil, RefreshCw, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

import type { WizardData } from './types';

type Target = 'cover' | number;

const KNOWN_ERRORS = ['limit_reached', 'ai_unavailable', 'validation_failed', 'bad_request'];

/** Código de error de la API traducible ("generic" si no lo conocemos). */
export function previewErrorKey(error: unknown): string {
  return error instanceof ApiError && KNOWN_ERRORS.includes(error.code) ? error.code : 'generic';
}

/**
 * Muestra de la historia: portada y primeras páginas con marca de agua, texto editable
 * (moderado en el servidor) y regeneración de ilustraciones con límite.
 */
export function PreviewPanel({
  book,
  generating,
  generateError,
  onRegenerateAll,
  onEditChoices,
}: {
  book: WizardData['book'];
  generating: boolean;
  generateError: string | null;
  onRegenerateAll: () => void;
  onEditChoices: () => void;
}) {
  const t = useTranslations('Wizard.preview');
  const [preview, setPreview] = useState<PublicPreview | null>(null);
  const [busy, setBusy] = useState<Target | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const isGenerating = generating || book.status === 'preview_generating';

  // Se recarga al terminar una generación (el estado llega en vivo desde Firestore).
  useEffect(() => {
    if (isGenerating) return;
    let cancelled = false;
    api('bookPreview', { params: { bookId: book.id } }).then(
      (result) => {
        if (!cancelled) setPreview(result);
      },
      () => {
        if (!cancelled) setError('generic');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isGenerating, book.id, book.status]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [isGenerating]);

  if (isGenerating) {
    return (
      <div className="container-page max-w-3xl py-16 text-center" role="status" aria-live="polite">
        <Loader2 className="mx-auto size-10 animate-spin text-primary" aria-hidden="true" />
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-6 text-[clamp(1.8rem,4vw,2.6rem)] font-semibold outline-none"
        >
          {t('generatingTitle')}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">{t('generatingText')}</p>
      </div>
    );
  }

  const data = preview?.preview ?? null;
  const failure = generateError ?? (preview?.error ? 'ai_unavailable' : null);

  async function run(target: Target, action: () => Promise<PublicPreview>) {
    setBusy(target);
    setError(null);
    try {
      setPreview(await action());
    } catch (caught) {
      setError(previewErrorKey(caught));
    } finally {
      setBusy(null);
    }
  }

  const regenerate = (target: Target) =>
    run(target, () =>
      api('regeneratePreviewIllustration', {
        params: { bookId: book.id, target: String(target) },
      }),
    );

  const canRegenerate = (preview?.regenerationsLeft ?? 0) > 0 && busy === null && !data?.stale;

  return (
    <div className="container-page max-w-4xl py-10">
      <p className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-black tracking-[0.08em] text-primary uppercase">
        <Sparkles className="size-3.5" aria-hidden="true" />
        {t('badge')}
      </p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-4 text-[clamp(2rem,4.5vw,3.2rem)] leading-[1.1] font-semibold outline-none"
      >
        {data?.title ?? t('badge')}
      </h1>

      {failure && !data && (
        <div role="alert" className="border-destructive/30 mt-8 rounded-xl border bg-card p-6">
          <p className="flex items-center gap-2 font-bold">
            <AlertTriangle className="text-destructive size-5" aria-hidden="true" />
            {t('failedTitle')}
          </p>
          <p className="mt-2 text-muted-foreground">{t(`errors.${failure}`)}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={onRegenerateAll}>{t('regenerateAll')}</Button>
            <Button variant="outline" onClick={onEditChoices}>
              {t('editChoices')}
            </Button>
          </div>
        </div>
      )}

      {data?.stale && (
        <div role="status" className="mt-6 rounded-xl border bg-butter/60 p-5">
          <p className="font-bold">{t('staleTitle')}</p>
          <p className="mt-1 text-muted-foreground">{t('staleText')}</p>
          <Button className="mt-4" onClick={onRegenerateAll}>
            <RefreshCw aria-hidden="true" />
            {t('regenerateAll')}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-destructive mt-6 font-semibold">
          {t(`errors.${error}`)}
        </p>
      )}

      {data && (
        <>
          <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <figure>
              <IllustrationFrame
                src={data.coverUrl}
                alt={t('coverAlt', { title: data.title })}
                busy={busy === 'cover'}
                busyLabel={t('regenerating')}
              />
              <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="font-display text-lg font-semibold">{t('cover')}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!canRegenerate}
                  onClick={() => void regenerate('cover')}
                >
                  <RefreshCw aria-hidden="true" />
                  {t('regenerate')}
                </Button>
              </figcaption>
            </figure>

            <aside className="self-start rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
              <h2 className="text-xl font-semibold">{t('differencesTitle')}</h2>
              <ul className="mt-3 grid gap-2 text-muted-foreground">
                <li>
                  {t('differencesPages', { total: data.totalPages, shown: data.pages.length })}
                </li>
                <li>{t('differencesWatermark')}</li>
                <li>{t('differencesEdit')}</li>
              </ul>
              <p className="mt-4 text-sm font-bold text-primary">
                {t('regenerationsLeft', { count: preview?.regenerationsLeft ?? 0 })}
              </p>
            </aside>
          </div>

          <ol className="mt-12 grid gap-10">
            {data.pages.map((page) => (
              <PreviewPage
                key={page.index}
                bookId={book.id}
                page={page}
                busy={busy === page.index}
                canRegenerate={canRegenerate}
                onRegenerate={() => void regenerate(page.index)}
                onSaved={setPreview}
                onError={setError}
              />
            ))}
          </ol>
        </>
      )}

      <div className="mt-12 flex flex-col gap-3 border-t pt-8 sm:flex-row sm:items-center">
        <Button variant="outline" onClick={onEditChoices}>
          {t('editChoices')}
        </Button>
        <div className="sm:ml-auto sm:text-right">
          <Button size="lg" disabled aria-describedby="continue-soon">
            {t('continue')}
          </Button>
          <p id="continue-soon" className="mt-2 max-w-sm text-sm text-muted-foreground">
            {t('continueSoon')}
          </p>
        </div>
      </div>
    </div>
  );
}

function IllustrationFrame({
  src,
  alt,
  busy,
  busyLabel,
}: {
  src: string | null;
  alt: string;
  busy: boolean;
  busyLabel: string;
}) {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted shadow-[var(--shadow-card)]">
      {src && (
        // URL firmada de corta duración: no pasa por el optimizador de imágenes.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="size-full object-cover" />
      )}
      {busy && (
        <div
          role="status"
          className="absolute inset-0 grid place-items-center bg-background/70 text-sm font-bold"
        >
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            {busyLabel}
          </span>
        </div>
      )}
    </div>
  );
}

function PreviewPage({
  bookId,
  page,
  busy,
  canRegenerate,
  onRegenerate,
  onSaved,
  onError,
}: {
  bookId: string;
  page: NonNullable<PublicPreview['preview']>['pages'][number];
  busy: boolean;
  canRegenerate: boolean;
  onRegenerate: () => void;
  onSaved: (preview: PublicPreview) => void;
  onError: (key: string | null) => void;
}) {
  const t = useTranslations('Wizard.preview');
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(page.text);
  const [saving, setSaving] = useState(false);
  const number = page.index + 1;
  const fieldId = `page-text-${String(page.index)}`;

  async function save() {
    setSaving(true);
    onError(null);
    try {
      onSaved(
        await api('updatePreviewPage', {
          params: { bookId, index: String(page.index) },
          body: { text },
        }),
      );
      setEditing(false);
    } catch (caught) {
      onError(previewErrorKey(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="grid items-start gap-6 md:grid-cols-2">
      <div>
        <IllustrationFrame
          src={page.imageUrl}
          alt={t('pageAlt', { number })}
          busy={busy}
          busyLabel={t('regenerating')}
        />
        <Button
          variant="ghost"
          size="sm"
          className="mt-3"
          disabled={!canRegenerate}
          onClick={onRegenerate}
        >
          <RefreshCw aria-hidden="true" />
          {t('regenerate')}
        </Button>
      </div>
      <div>
        <h2 className="font-display text-lg font-semibold">{t('page', { number })}</h2>
        {editing ? (
          <div className="mt-3 grid gap-3">
            <label htmlFor={fieldId} className="sr-only">
              {t('textLabel', { number })}
            </label>
            <textarea
              id={fieldId}
              value={text}
              maxLength={800}
              rows={6}
              onChange={(event) => {
                setText(event.target.value);
              }}
              className="w-full rounded-lg border bg-card p-3 text-lg leading-relaxed"
            />
            <div className="flex gap-2">
              <Button disabled={saving || text.trim().length === 0} onClick={() => void save()}>
                {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                {t('saveText')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setText(page.text);
                  setEditing(false);
                }}
              >
                {t('cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-3 font-display text-xl leading-relaxed">{page.text}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => {
                setEditing(true);
              }}
            >
              <Pencil aria-hidden="true" />
              {t('editText')}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
