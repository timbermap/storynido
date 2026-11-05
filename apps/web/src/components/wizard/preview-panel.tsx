'use client';

import { PREVIEW_PAGE_TEXT_MAX, type Locale, type PublicPreview } from '@storynido/shared';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Droplets,
  Loader2,
  Pencil,
  PencilLine,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { SignInPanel } from '@/components/auth/sign-in-panel';
import { BookViewer, type ViewerPage } from '@/components/book/book-viewer';
import { Button, buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { trackConversion } from '@/lib/conversions';
import { formatPrice } from '@/lib/format';

import { CharacterReview } from './character-review';
import { BirthdayBookOffer, InvitationPreview } from './party-preview';
import { cn } from '@/lib/utils';

import { previewErrorKey } from './preview-errors';
import { PreviewFeedback } from './preview-feedback';
import type { WizardData } from './types';

type Target = 'cover' | number;
type PreviewData = NonNullable<PublicPreview['preview']>;

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
  prices,
  eventPrices,
  generating,
  generateError,
  onRegenerateAll,
  onEditChoices,
}: {
  book: WizardData['book'];
  childName: string;
  prices: WizardData['prices'];
  eventPrices: WizardData['eventPrices'];
  generating: boolean;
  generateError: string | null;
  onRegenerateAll: () => void;
  onEditChoices: () => void;
}) {
  const t = useTranslations('Wizard.preview');
  const tViewer = useTranslations('Viewer');
  const tBook = useTranslations('Wizard.book');
  const tParty = useTranslations('Wizard.partyPreview');
  const isEvent = book.channel === 'events';
  const isPro = book.channel === 'professionals';
  const proMinor = isPro && book.length ? prices?.proByLength[book.length] : undefined;
  const locale = useLocale() as Locale;
  const money = (minor: number) =>
    prices ? formatPrice(minor, prices.currency, locale, prices.country) : '';
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

  // Cuento con su dibujo de siempre (del perfil): la espera lo muestra y no pide aprobarlo.
  const withDrawing = book.useDrawing === true && Boolean(book.childId);
  const [drawingUrl, setDrawingUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!withDrawing || !book.childId || !isGenerating) return;
    let cancelled = false;
    api('getChildProfile', { params: { childId: book.childId } })
      .then((profile) => {
        if (!cancelled) setDrawingUrl(profile.characterImageUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [withDrawing, book.childId, isGenerating]);

  const data = preview?.preview ?? null;
  // Vista previa lista: se cuenta una vez por libro (solo la línea, nada del niño).
  const previewDone = data?.stage === 'complete';
  useEffect(() => {
    if (previewDone)
      trackConversion(`preview:${book.id}`, { name: 'preview_created', line: book.channel });
  }, [previewDone, book.id, book.channel]);

  if (isGenerating && withDrawing) {
    // Con su dibujo de siempre: no se dibuja ni se aprueba de nuevo, se escribe y se ilustra.
    const steps = ['write', 'illustrate', 'order'] as const;
    const active = data?.stage === 'character' ? 1 : 0;
    return (
      <div className="container-page max-w-3xl py-16 text-center" role="status" aria-live="polite">
        <div className="relative mx-auto w-24">
          <div className="aspect-[3/4] overflow-hidden rounded-2xl border bg-card">
            {drawingUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- URL firmada de 30 min.
              <img
                src={drawingUrl}
                alt={t('drawingWait.alt', { name: childName })}
                className="size-full object-cover"
              />
            )}
          </div>
          <Loader2
            className="absolute -right-3 -bottom-3 size-8 animate-spin rounded-full bg-background p-1 text-primary"
            aria-hidden="true"
          />
        </div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-6 text-[clamp(1.8rem,4vw,2.6rem)] font-medium outline-none"
        >
          {t('drawingWait.title', { name: childName })}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">
          {t('drawingWait.text')}
        </p>
        <ol className="mx-auto mt-8 grid max-w-3xl gap-2 text-left text-sm sm:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step}
              aria-current={index === active ? 'step' : undefined}
              className={
                index === active
                  ? 'rounded-xl border-2 border-primary bg-card p-3 font-semibold'
                  : 'rounded-xl border bg-card/60 p-3 text-muted-foreground'
              }
            >
              <span className="block text-xs font-bold tracking-wide uppercase">{index + 1}</span>
              {t(`drawingWait.steps.${step}`)}
            </li>
          ))}
        </ol>
        <div className="mx-auto mt-8 grid max-w-xl justify-items-center gap-2 rounded-2xl border bg-card p-5">
          <p className="font-semibold">{t('leaveTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('leaveText')}</p>
          <Link href="/my-stories" className={buttonVariants({ variant: 'outline' })}>
            {t('leaveButton')}
          </Link>
        </div>
      </div>
    );
  }

  if (isGenerating) {
    // Si ya había un personaje en revisión, lo que se está generando son las ilustraciones.
    const illustrating = data?.stage === 'character';
    const steps = ['character', 'review', 'illustrate', 'order'] as const;
    const active = illustrating ? 2 : 0;
    return (
      <div className="container-page max-w-3xl py-16 text-center" role="status" aria-live="polite">
        <Loader2 className="mx-auto size-10 animate-spin text-primary" aria-hidden="true" />
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-6 text-[clamp(1.8rem,4vw,2.6rem)] font-medium outline-none"
        >
          {illustrating ? t('illustrating') : t('generatingTitle', { name: childName })}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">
          {illustrating ? t('illustratingText') : t('generatingText', { name: childName })}
        </p>
        <ol className="mx-auto mt-8 grid max-w-3xl gap-2 text-left text-sm sm:grid-cols-4">
          {steps.map((step, index) => (
            <li
              key={step}
              aria-current={index === active ? 'step' : undefined}
              className={
                index === active
                  ? 'rounded-xl border-2 border-primary bg-card p-3 font-semibold'
                  : 'rounded-xl border bg-card/60 p-3 text-muted-foreground'
              }
            >
              <span className="block text-xs font-bold tracking-wide uppercase">{index + 1}</span>
              {t(`waitSteps.${step}`, { name: childName })}
            </li>
          ))}
        </ol>
        <div className="mx-auto mt-8 grid max-w-xl justify-items-center gap-2 rounded-2xl border bg-card p-5">
          <p className="font-semibold">{t('leaveTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('leaveText')}</p>
          <Link href="/my-stories" className={buttonVariants({ variant: 'outline' })}>
            {t('leaveButton')}
          </Link>
        </div>
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
        </div>
      )}

      {data?.stage === 'complete' && (
        <div className="mt-8 grid gap-6 [&>*]:min-w-0">
          {data.character?.fromDrawing && book.childId && (
            // Su dibujo de siempre: si no se parece, se ajusta en su perfil (y vale para los próximos).
            <p className="text-sm text-muted-foreground">
              {t.rich('drawingUsed', {
                name: childName,
                link: (chunks) => (
                  <Link
                    href={{
                      pathname: '/my-stories/characters/[childId]',
                      params: { childId: book.childId ?? '' },
                    }}
                    className="font-semibold text-primary underline"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          )}
          {isEvent && (
            // Primero lo que se manda a los invitados: es lo que decide la compra.
            <section aria-labelledby="party-invitation" className="grid gap-3">
              <h2 id="party-invitation" className="text-xl font-medium">
                {tParty('invitationTitle')}
              </h2>
              <div className="max-w-sm">
                <InvitationPreview
                  book={book}
                  childName={childName}
                  imageUrl={data.coverUrl ?? data.character?.imageUrl ?? null}
                />
              </div>
            </section>
          )}
          <aside className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <div className="flex flex-wrap items-center gap-3">
                {data.character?.approved && (
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1 text-sm font-bold text-success">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    {t('approvedBadge')}
                  </p>
                )}
                <h2 className="text-xl font-medium">{t('differencesTitle')}</h2>
              </div>
              {/* Sin contador visible: solo el aviso del último ajuste o de que ya no quedan. */}
              {regenerationsLeft <= 1 && (
                <p className="rounded-full border px-3 py-1 text-sm font-bold">
                  {regenerationsLeft === 1 ? t('lastAdjustment') : t('noAdjustmentsLeft')}
                </p>
              )}
            </div>
            <ul className="mt-4 grid gap-4 font-sans text-sm leading-snug md:grid-cols-3 md:gap-6">
              {[
                {
                  icon: BookOpen,
                  text: t('differencesPages', {
                    total: data.totalPages,
                    shown: data.pages.filter((page) => page.imageUrl).length,
                  }),
                },
                { icon: Droplets, text: t('differencesWatermark') },
                {
                  icon: PencilLine,
                  text: isEvent
                    ? tParty('differencesEdit')
                    : isPro
                      ? t('proDifferencesEdit')
                      : t('differencesEdit'),
                },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-peach text-navy">
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                  <span className="pt-1.5 text-foreground/80">{text}</span>
                </li>
              ))}
            </ul>
          </aside>
          <div className="grid gap-4 [&>*]:min-w-0">
            {isEvent && <h2 className="text-xl font-medium">{tParty('keepsakeTitle')}</h2>}
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
        </div>
      )}

      {isEvent && data?.stage === 'complete' && !data.stale && (
        <div className="mt-8">
          <BirthdayBookOffer book={book} childName={childName} prices={prices} />
        </div>
      )}

      {/* Mientras falta confirmar al personaje, el único paso es el botón de arriba: sin barra. */}
      {!(data?.stage === 'character' && data.character && !data.character.approved) && (
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
                className={cn(buttonVariants({ size: 'lg' }), 'h-14 px-10 text-lg')}
              >
                {isEvent || isPro ? t('approveAndPay') : t('continue')}
              </Link>
            ) : null}
            {data?.stage === 'complete' && !data.stale && isEvent && eventPrices && (
              <p className="mt-2 text-sm text-muted-foreground tabular-nums">
                {book.event?.offer === 'invitation'
                  ? tParty('priceInvitation', {
                      price: formatPrice(
                        eventPrices.invitationMinor,
                        eventPrices.currency,
                        locale,
                        eventPrices.country,
                      ),
                    })
                  : tParty('priceKit', {
                      price: formatPrice(
                        eventPrices.fullKitMinor,
                        eventPrices.currency,
                        locale,
                        eventPrices.country,
                      ),
                    })}
              </p>
            )}
            {data?.stage === 'complete' && !data.stale && isPro && proMinor !== undefined && (
              <div className="mt-2 grid gap-0.5 text-sm text-muted-foreground tabular-nums">
                <p>{t('proPrice', { price: money(proMinor) })}</p>
                <p>{t('proVolume')}</p>
              </div>
            )}
            {data?.stage === 'complete' && !data.stale && !isEvent && !isPro && prices && (
              // Qué cuesta antes de entrar al pago (formato y envío se eligen ahí).
              <p className="mt-2 text-sm text-muted-foreground tabular-nums">
                {[
                  prices.digitalMinor != null &&
                    tBook('priceDigital', { price: money(prices.digitalMinor) }),
                  prices.printedFromMinor != null &&
                    tBook('pricePrinted', { price: money(prices.printedFromMinor) }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            {data?.stage === 'complete' && !data.stale ? null : (
              <>
                <Button
                  size="lg"
                  disabled
                  aria-describedby="continue-soon"
                  className="h-14 px-10 text-lg"
                >
                  {t('continue')}
                </Button>
                <p id="continue-soon" className="mt-2 max-w-sm text-sm text-muted-foreground">
                  {t('continueAfterApproval')}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {data?.stage === 'complete' && isPro && (
        <p className="mt-6 rounded-xl bg-secondary p-4 text-sm">{t('proNotice')}</p>
      )}

      {data?.stage === 'complete' && <PreviewFeedback bookId={book.id} />}

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
    </div>
  );
}
