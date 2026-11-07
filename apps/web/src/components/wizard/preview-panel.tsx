'use client';

import {
  PREVIEW_PAGE_TEXT_MAX,
  PREVIEW_WAIT_MINUTES,
  type Locale,
  type PreviewWaitKind,
  type PublicPreview,
} from '@storynido/shared';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
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
import { useProStatus } from '@/components/pro/use-pro-status';
import { BookViewer, type ViewerPage } from '@/components/book/book-viewer';
import { Button, buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { trackConversion } from '@/lib/conversions';
import { formatPrice } from '@/lib/format';
import { bookPrices } from '@/lib/offer';

import { CharacterReview } from './character-review';
import { KitIncludes } from './kit-includes';
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
      layout: page.layout,
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
  familyBookPages,
  generating,
  generateError,
  onRegenerateAll,
  onEditChoices,
}: {
  book: WizardData['book'];
  childName: string;
  prices: WizardData['prices'];
  eventPrices: WizardData['eventPrices'];
  /** Páginas del libro de Familias (el upsell del kit habla del cuento largo, no del mini). */
  familyBookPages: number;
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
  // Profesionales: lo decide la cuenta (el checkout cobra su precio con el descuento base).
  const { status: proStatus } = useProStatus();
  const professional = proStatus?.accountType === 'professional';
  // Precio exacto de este libro (su extensión), el mismo que las tarjetas y el resumen del pago.
  const bookPrice =
    prices && book.length ? bookPrices(prices, book.length, professional, book.contentType) : null;
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

  // Si termina con la pestaña en segundo plano, el título lo avisa (y vuelve al volver).
  const wasGenerating = useRef(isGenerating);
  useEffect(() => {
    const finished = wasGenerating.current && !isGenerating;
    wasGenerating.current = isGenerating;
    if (!finished || !document.hidden) return;
    const original = document.title;
    document.title = t('readyTab', { name: childName });
    const restore = () => {
      if (!document.hidden) {
        document.title = original;
        document.removeEventListener('visibilitychange', restore);
      }
    };
    document.addEventListener('visibilitychange', restore);
    return () => {
      document.removeEventListener('visibilitychange', restore);
    };
  }, [isGenerating, t, childName]);

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

  if (book.status === 'preview_queued') {
    // Sin cupo de IA por ahora: la muestra espera en la fila, arranca sola y se avisa por correo.
    // Nunca se le muestra un "límite" al cliente.
    return (
      <div className="container-page max-w-3xl py-16 text-center" role="status" aria-live="polite">
        <Clock className="mx-auto size-12 text-primary" aria-hidden="true" />
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-6 text-[clamp(1.8rem,4vw,2.6rem)] font-medium outline-none"
        >
          {data?.stage === 'character'
            ? t('queued.illustrationsTitle', { name: childName })
            : t('queued.title', { name: childName })}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">{t('queued.text')}</p>
        <Link href="/my-stories" className={cn(buttonVariants({ variant: 'outline' }), 'mt-8')}>
          {t('queued.back')}
        </Link>
      </div>
    );
  }

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
            className="absolute -right-3 -bottom-3 size-8 animate-spin rounded-full bg-background p-1 text-primary motion-reduce:animate-none"
            aria-hidden="true"
          />
        </div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-6 text-[clamp(1.8rem,4vw,2.6rem)] font-medium outline-none"
        >
          {isEvent
            ? book.event?.offer === 'invitation'
              ? t('eventWait.titleInvitation', { name: childName })
              : t('eventWait.titleKit', { name: childName })
            : t('drawingWait.title', { name: childName })}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">
          {isEvent
            ? t('eventWait.textDrawing', { theme: book.event?.theme ?? '' })
            : t('drawingWait.text')}
        </p>
        <WaitEstimate kind="withDrawing" startedAt={book.previewStartedAt} />
        <WaitSteps
          active={active}
          labels={steps.map((step) =>
            isEvent ? t(`eventWait.steps.${step}`) : t(`drawingWait.steps.${step}`),
          )}
        />
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
        <Loader2
          className="mx-auto size-10 animate-spin text-primary motion-reduce:animate-none"
          aria-hidden="true"
        />
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
        <WaitEstimate
          kind={illustrating ? 'illustrate' : 'character'}
          startedAt={book.previewStartedAt}
        />
        <WaitSteps
          active={active}
          labels={steps.map((step) =>
            isEvent
              ? t(`eventWait.steps4.${step}`, { name: childName })
              : t(`waitSteps.${step}`, { name: childName }),
          )}
        />
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

  // Muestra lista para pedir: el botón va en la barra fija de abajo.
  const ready = data?.stage === 'complete' && !data.stale;

  // Solo si ya usó alguno: queda exactamente 1 → «el último»; ninguno → «ya los usaste».
  const adjustmentNotice =
    regenerationsLeft === 0
      ? t('noAdjustmentsLeft')
      : regenerationsLeft === 1 && book.regenerationsUsed > 0
        ? t('lastAdjustment')
        : null;

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
        {illustrated && adjustmentNotice && (
          // Sin contador visible (decisión del 4/11): solo el aviso del último ajuste o de que ya no
          // quedan, junto al botón que los usa.
          <span className="self-center text-xs font-semibold text-muted-foreground">
            {adjustmentNotice}
          </span>
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

      {data?.character?.ageMismatch && (
        <div role="status" className="mt-6 rounded-xl border bg-butter/60 p-5">
          <p className="flex items-center gap-2 font-bold">
            <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
            {t('ageMismatchTitle')}
          </p>
          <p className="mt-1 text-muted-foreground">
            {t('ageMismatchText', { name: childName, age: data.character.ageMismatch.entered })}
          </p>
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
          {/* Una sola línea de estado: con qué personaje se dibujó y cómo ajustarlo. */}
          {data.character?.fromDrawing && book.childId ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
              {t.rich('drawingStatus', {
                name: childName,
                link: (chunks) => (
                  <Link
                    href={{
                      pathname: '/my-stories/characters/[childId]',
                      params: { childId: book.childId ?? '' },
                      // Al terminar el ajuste, vuelve a esta muestra (no se pierde la compra).
                      query: { volver: book.id },
                    }}
                    className="font-semibold text-primary underline"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          ) : (
            data.character?.approved && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                {t('approvedBadge')}
              </p>
            )
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
          <div className="grid gap-4 [&>*]:min-w-0">
            {isEvent && (
              <>
                {/* Qué trae el kit, antes del mini cuento: así se entiende que es una de las piezas. */}
                <KitIncludes offer={book.event?.offer ?? 'full_kit'} />
                <div className="grid gap-0.5">
                  <h2 className="text-xl font-medium">
                    {tParty('keepsakeTitle', { pages: data.totalPages })}
                  </h2>
                  <p className="text-sm text-muted-foreground">{tParty('keepsakeText')}</p>
                </div>
              </>
            )}
            <BookViewer
              title={data.title}
              coverName={childName}
              pages={viewerPages(data)}
              imageAlt={(page) =>
                page.kind === 'cover'
                  ? t('coverAlt', { title: data.title })
                  : t('pageAlt', { number: page.number ?? 0 })
              }
              lockedLabel={tViewer('locked')}
              typography={data.typography ?? null}
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
            {/* Qué cambia en el libro final: compacto, debajo del libro (lo principal es el libro). */}
            <ul
              aria-label={t('differencesTitle')}
              className="grid gap-2 font-sans text-sm leading-snug text-foreground/80 sm:grid-cols-3 sm:gap-4"
            >
              {[
                {
                  icon: BookOpen,
                  text: t(isEvent ? 'eventDifferencesPages' : 'differencesPages', {
                    total: data.totalPages,
                    shown: data.pages.filter((page) => page.imageUrl).length,
                  }),
                },
                { icon: Droplets, text: t('differencesWatermark') },
                {
                  icon: PencilLine,
                  text: isEvent
                    ? t('differencesEdit')
                    : isPro
                      ? t('proDifferencesEdit')
                      : t('differencesEdit'),
                },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2">
                  <Icon
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {isEvent && data?.stage === 'complete' && !data.stale && (
        <div className="mt-8">
          <BirthdayBookOffer
            book={book}
            childName={childName}
            prices={prices}
            familyPages={familyBookPages}
          />
        </div>
      )}

      {/* Mientras falta confirmar al personaje, el único paso es el botón de arriba: sin barra. */}
      {/* Con el error a la vista, su tarjeta ya ofrece «Cambiar mis elecciones»: sin barra repetida. */}
      {!(failure && !data) &&
        !(data?.stage === 'character' && data.character && !data.character.approved) && (
          <div className="mt-12 flex flex-col gap-3 border-t pt-8 sm:flex-row sm:items-center">
            <Button variant="outline" onClick={onEditChoices}>
              {t('editChoices')}
            </Button>
            <div
              className={
                ready
                  ? // «Quiero este libro» siempre a la vista: barra fija abajo, con el precio al lado
                    // (en el creador no está la barra de navegación del móvil).
                    'fixed inset-x-0 bottom-0 z-30 flex flex-row-reverse items-center justify-between gap-3 border-t bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md sm:px-[max(1.5rem,calc((100vw-64rem)/2))] [&_p]:mt-0 [&_p]:text-left [&>a]:h-12 [&>a]:shrink-0 [&>a]:px-6 [&>a]:text-base sm:[&>a]:h-14 sm:[&>a]:px-10 sm:[&>a]:text-lg'
                  : 'sm:ml-auto sm:text-right'
              }
            >
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
                  {isEvent
                    ? book.event?.offer === 'invitation'
                      ? t('continueInvitation')
                      : t('continueKit')
                    : isPro
                      ? t('approveAndPay')
                      : t('continue')}
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
              {data?.stage === 'complete' && !data.stale && !isEvent && bookPrice && (
                // Qué cuesta este libro antes de entrar al pago (el envío se suma con la dirección).
                <div className="mt-2 grid gap-0.5 text-sm text-muted-foreground tabular-nums">
                  <p>
                    {[
                      bookPrice.digital != null &&
                        tBook('priceDigital', { price: money(bookPrice.digital) }),
                      bookPrice.printed != null &&
                        tBook(
                          bookPrice.printedFormats.length > 1 ? 'pricePrintedFrom' : 'pricePrinted',
                          { price: money(bookPrice.printed) },
                        ),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <p className="text-xs">{tBook('priceUsd')}</p>
                  {professional && isPro && <p>{t('proVolume')}</p>}
                </div>
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
      {/* Lugar para la barra fija: no tapa el final de la página. */}
      {ready && <div aria-hidden="true" className="h-28" />}

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

/**
 * «Suele estar en unos N minutos», con los tiempos reales (PREVIEW_WAIT_MINUTES). Si pasa del
 * estimado, lo dice con calma; nada de cuenta regresiva ni barra inventada.
 */
function WaitEstimate({ kind, startedAt }: { kind: PreviewWaitKind; startedAt: unknown }) {
  const t = useTranslations('Wizard.preview');
  const minutes = PREVIEW_WAIT_MINUTES[kind];
  const [mountedAt] = useState(() => Date.now());
  const since = millisOf(startedAt) ?? mountedAt;
  const [late, setLate] = useState(false);
  useEffect(() => {
    const check = () => {
      setLate(Date.now() - since > minutes * 60_000);
    };
    check();
    const timer = window.setInterval(check, 15_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [since, minutes]);
  return (
    <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-muted-foreground">
      {late ? t('waitLate') : t('waitEstimate', { minutes })}
    </p>
  );
}

/** Fecha de Firestore (Timestamp), Date o nada → milisegundos. */
function millisOf(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object' && 'toMillis' in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

/**
 * Pasos de la espera. Todas las tarjetas tienen el mismo borde, el mismo peso de letra y la
 * misma altura (la fila se estira a la más alta), así el texto no salta ni se desalinea:
 * el paso actual se marca solo con el color del borde y del número, y los anteriores con ✓.
 */
function WaitSteps({ labels, active }: { labels: string[]; active: number }) {
  return (
    <ol
      className={cn(
        'mx-auto mt-8 grid max-w-3xl gap-2 text-left text-sm',
        labels.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3',
      )}
    >
      {labels.map((label, index) => {
        const state = index < active ? 'done' : index === active ? 'current' : 'next';
        return (
          <li
            key={index}
            aria-current={state === 'current' ? 'step' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl border-2 bg-card p-3 font-sans font-medium sm:flex-col sm:items-start sm:gap-2',
              state === 'current'
                ? 'border-primary text-foreground shadow-sm'
                : 'border-border text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold',
                state === 'current' && 'bg-primary text-primary-foreground',
                state === 'done' && 'bg-mint text-success',
                state === 'next' && 'bg-muted text-muted-foreground',
              )}
              aria-hidden="true"
            >
              {state === 'done' ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
            </span>
            <span className="leading-snug text-balance">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
