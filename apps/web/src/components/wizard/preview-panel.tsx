'use client';

import { ApiError, PREVIEW_PAGE_TEXT_MAX, type PublicPreview } from '@storynido/shared';
import { AlertTriangle, CheckCircle2, Loader2, Pencil, RefreshCw, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { SignInPanel } from '@/components/auth/sign-in-panel';
import { BookViewer, type ViewerPage } from '@/components/book/book-viewer';
import { Button, buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';

import { CharacterReview } from './character-review';
import type { WizardData } from './types';

type Target = 'cover' | number;
type PreviewData = NonNullable<PublicPreview['preview']>;

const KNOWN_ERRORS = [
  'limit_reached',
  'ai_unavailable',
  'validation_failed',
  'bad_request',
  'account_required',
];

/** Código de error de la API traducible ("generic" si no lo conocemos). */
export function previewErrorKey(error: unknown): string {
  return error instanceof ApiError && KNOWN_ERRORS.includes(error.code) ? error.code : 'generic';
}

/** Páginas del visor: portada, dedicatoria, el cuento completo y el cierre. */
function viewerPages(preview: PreviewData): ViewerPage[] {
  return [
    { key: 'cover', kind: 'cover', imageUrl: preview.coverUrl, text: null },
    { key: 'dedication', kind: 'dedication', imageUrl: null, text: preview.dedication },
    ...preview.pages.map((page) => ({
      key: `page-${String(page.index)}`,
      kind: 'story' as const,
      imageUrl: page.imageUrl,
      text: page.text,
      number: page.index + 1,
    })),
    { key: 'end', kind: 'end', imageUrl: null, text: null },
  ];
}

/**
 * Muestra de la historia en 2 etapas: primero el adulto aprueba al personaje ("¿Es él / es
 * ella?"); después ve el libro entero en el visor, con la portada y las primeras páginas
 * ilustradas (marca de agua), el resto con su texto, y puede editar textos y pedir otra
 * ilustración dentro del límite.
 */
export function PreviewPanel({
  book,
  childName,
  generating,
  generateError,
  onRegenerateAll,
  onEditChoices,
}: {
  book: WizardData['book'];
  childName: string;
  generating: boolean;
  generateError: string | null;
  onRegenerateAll: () => void;
  onEditChoices: () => void;
}) {
  const t = useTranslations('Wizard.preview');
  const tViewer = useTranslations('Viewer');
  const { user } = useAuth();
  const [preview, setPreview] = useState<PublicPreview | null>(null);
  const [busy, setBusy] = useState<Target | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
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

  const data = preview?.preview ?? null;

  if (isGenerating) {
    // Si ya había un personaje en revisión, lo que se está generando son las ilustraciones.
    const illustrating = data?.stage === 'character';
    return (
      <div className="container-page max-w-3xl py-16 text-center" role="status" aria-live="polite">
        <Loader2 className="mx-auto size-10 animate-spin text-primary" aria-hidden="true" />
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-6 text-[clamp(1.8rem,4vw,2.6rem)] font-medium outline-none"
        >
          {illustrating ? t('illustrating') : t('generatingTitle')}
        </h1>
        {!illustrating && (
          <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">
            {t('generatingText')}
          </p>
        )}
      </div>
    );
  }

  const failure = generateError ?? (preview?.error ? 'ai_unavailable' : null);
  const regenerationsLeft = preview?.regenerationsLeft ?? 0;

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

  async function saveText() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      setPreview(
        await api('updatePreviewPage', {
          params: { bookId: book.id, index: String(editing.index) },
          body: { text: editing.text },
        }),
      );
      setEditing(null);
    } catch (caught) {
      setError(previewErrorKey(caught));
    } finally {
      setSaving(false);
    }
  }

  const canRegenerate =
    data?.stage === 'complete' && regenerationsLeft > 0 && busy === null && !data.stale;

  /** Acciones de la página visible del visor. */
  const actions = (page: ViewerPage) => {
    if (page.kind !== 'cover' && page.kind !== 'story') return null;
    const target: Target = page.kind === 'cover' ? 'cover' : (page.number ?? 1) - 1;
    const illustrated = page.imageUrl !== null;
    return (
      <div className="flex flex-wrap gap-2">
        {page.kind === 'story' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing({ index: (page.number ?? 1) - 1, text: page.text ?? '' });
            }}
          >
            <Pencil aria-hidden="true" />
            {t('editText')}
          </Button>
        )}
        {illustrated && (
          <Button
            variant="ghost"
            size="sm"
            disabled={!canRegenerate}
            onClick={() =>
              void run(target, () =>
                api('regeneratePreviewIllustration', {
                  params: { bookId: book.id, target: String(target) },
                }),
              )
            }
          >
            {busy === target ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
            {busy === target ? t('regenerating') : t('regenerate')}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="container-page max-w-5xl py-10">
      <p className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-bold tracking-[0.08em] text-primary uppercase">
        <Sparkles className="size-3.5" aria-hidden="true" />
        {t('badge')}
      </p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-4 text-[clamp(2rem,4.5vw,3.2rem)] leading-[1.1] font-medium outline-none"
      >
        {data?.title ?? t('badge')}
      </h1>

      {failure && !data && (
        <div role="alert" className="mt-8 rounded-xl border border-destructive/30 bg-card p-6">
          <p className="flex items-center gap-2 font-bold">
            <AlertTriangle className="size-5 text-destructive" aria-hidden="true" />
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
        <p role="alert" className="mt-6 font-semibold text-destructive">
          {t(`errors.${error}`)}
        </p>
      )}

      {data?.stage === 'character' && data.character && (
        <div className="mt-8 grid gap-10 [&>*]:min-w-0">
          <CharacterReview
            bookId={book.id}
            childName={childName}
            character={data.character}
            regenerationsLeft={regenerationsLeft}
            onUpdated={setPreview}
            onError={setError}
          />
          <section aria-labelledby="read-while" className="grid gap-4 [&>*]:min-w-0">
            <h2 id="read-while" className="text-2xl font-medium">
              {t('readWhile')}
            </h2>
            <BookViewer
              title={data.title}
              pages={viewerPages(data)}
              imageAlt={(page) =>
                page.kind === 'cover'
                  ? t('coverAlt', { title: data.title })
                  : t('pageAlt', { number: page.number ?? 0 })
              }
              lockedLabel={tViewer('locked')}
            />
          </section>
        </div>
      )}

      {data?.stage === 'complete' && (
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] [&>*]:min-w-0">
          <div className="grid gap-4 [&>*]:min-w-0">
            <BookViewer
              title={data.title}
              pages={viewerPages(data)}
              imageAlt={(page) =>
                page.kind === 'cover'
                  ? t('coverAlt', { title: data.title })
                  : t('pageAlt', { number: page.number ?? 0 })
              }
              lockedLabel={tViewer('locked')}
              actions={actions}
              onPageChange={() => {
                setEditing(null);
              }}
            />
            {editing && (
              <div className="grid gap-3 rounded-xl border bg-card p-4">
                <label htmlFor="page-text-editor" className="font-bold">
                  {t('textLabel', { number: editing.index + 1 })}
                </label>
                <textarea
                  id="page-text-editor"
                  value={editing.text}
                  maxLength={PREVIEW_PAGE_TEXT_MAX}
                  rows={6}
                  onChange={(event) => {
                    setEditing({ ...editing, text: event.target.value });
                  }}
                  className="w-full rounded-lg border bg-card p-3 text-lg leading-relaxed"
                />
                <div className="flex gap-2">
                  <Button
                    disabled={saving || editing.text.trim().length === 0}
                    onClick={() => void saveText()}
                  >
                    {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                    {t('saveText')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditing(null);
                    }}
                  >
                    {t('cancel')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <aside className="self-start rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
            {data.character?.approved && (
              <p className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-success">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {t('approvedBadge')}
              </p>
            )}
            <h2 className="text-xl font-medium">{t('differencesTitle')}</h2>
            <ul className="mt-3 grid gap-2 text-muted-foreground">
              <li>
                {t('differencesPages', {
                  total: data.totalPages,
                  shown: data.pages.filter((page) => page.imageUrl).length,
                })}
              </li>
              <li>{t('differencesWatermark')}</li>
              <li>{t('differencesEdit')}</li>
            </ul>
            <p className="mt-4 text-sm font-bold text-primary">
              {t('regenerationsLeft', { count: regenerationsLeft })}
            </p>
          </aside>
        </div>
      )}

      {data?.stage === 'complete' && user?.isAnonymous && (
        <section
          aria-labelledby="save-story"
          className="mt-12 grid gap-6 rounded-xl bg-secondary p-6 sm:p-8 md:grid-cols-2 md:items-center"
        >
          <div>
            <h2 id="save-story" className="text-2xl font-medium">
              {t('saveStoryTitle')}
            </h2>
            <p className="mt-2 text-muted-foreground">{t('saveStoryText')}</p>
          </div>
          <SignInPanel />
        </section>
      )}

      <div className="mt-12 flex flex-col gap-3 border-t pt-8 sm:flex-row sm:items-center">
        <Button variant="outline" onClick={onEditChoices}>
          {t('editChoices')}
        </Button>
        <div className="sm:ml-auto sm:text-right">
          {data?.stage === 'complete' && !data.stale ? (
            <Link
              href={{
                pathname: '/checkout/[bookId]',
                params: { bookId: book.id },
                // Eventos: el kit de cumpleaños (un diseño, muchas copias).
                query: book.channel === 'events' ? { kit: '1' } : {},
              }}
              className={buttonVariants({ size: 'lg' })}
            >
              {t('continue')}
            </Link>
          ) : data?.stage === 'character' && data.character && !data.character.approved ? (
            // Falta aprobar al personaje (más arriba): el botón lleva ahí en vez de estar gris.
            <>
              <a href="#character-review" className={buttonVariants({ size: 'lg' })}>
                {t('reviewCharacter')}
              </a>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                {t('approveFirst', { name: childName })}
              </p>
            </>
          ) : (
            <>
              <Button size="lg" disabled aria-describedby="continue-soon">
                {t('continue')}
              </Button>
              <p id="continue-soon" className="mt-2 max-w-sm text-sm text-muted-foreground">
                {t('continueAfterApproval')}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
