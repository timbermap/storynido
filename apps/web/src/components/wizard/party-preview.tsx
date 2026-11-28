'use client';

import { Download, MessageCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  BIRTHDAY_BOOK_CHOICES,
  EMPTY_BIRTHDAY,
  formatEventTime,
  invitationCopy,
  type BirthdayBookChoice,
  type Locale,
} from '@storynido/shared';

import { ShareButton } from '@/components/share-button';
import { Button } from '@/components/ui/button';
import { getPathname } from '@/i18n/navigation';
import { getFirebaseDb } from '@/lib/firebase/client';
import { updateBook } from '@/lib/firebase/drafts';
import { formatPrice } from '@/lib/format';

import { drawFreeInvitation, FREE_INVITATION_SIZE } from './free-invitation';
import { OptionCard } from './option-card';
import type { PriceHint, WizardData } from './types';

/**
 * La invitación armada con el personaje aprobado y los datos de la fiesta. Es solo código: no
 * genera ninguna imagen, y el PDF final usa los mismos textos.
 */
export function InvitationPreview({
  book,
  childName,
  imageUrl,
}: {
  book: WizardData['book'];
  childName: string;
  imageUrl: string | null;
}) {
  const t = useTranslations('Wizard.partyPreview');
  const locale = useLocale() as Locale;
  const event = book.event;
  const copy = invitationCopy(book.language, event?.type, event?.tone);
  const date = event?.date
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
        new Date(`${event.date}T00:00:00Z`),
      )
    : null;
  return (
    <figure className="m-0 overflow-hidden rounded-2xl border bg-peach shadow-[var(--shadow-card)]">
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- imagen firmada de la muestra
        <img
          src={imageUrl}
          alt=""
          className="block aspect-[4/5] w-full bg-card object-cover object-top"
        />
      )}
      <figcaption className="grid gap-1 p-5 text-center">
        <p className="font-display text-2xl leading-tight font-semibold">
          {event?.type === 'birthday' && event.turningAge
            ? t('turning', { name: childName, age: event.turningAge })
            : childName}
        </p>
        <p className="font-semibold">{copy.invite}</p>
        {date && <p className="text-sm">{date}</p>}
        {formatEventTime(book.language, event?.startTime, event?.endTime) && (
          <p className="text-sm">
            {formatEventTime(book.language, event?.startTime, event?.endTime)}
          </p>
        )}
        {event?.place && <p className="text-sm">{event.place}</p>}
        <p className="mt-1 text-sm font-semibold">{copy.waiting}</p>
      </figcaption>
    </figure>
  );
}

/** La familia de letra que usa la página para una variable de fuente (para dibujar en el canvas). */
function cssFont(variable: string, fallback: string): string {
  const probe = document.createElement('span');
  probe.style.fontFamily = `var(${variable}), ${fallback}`;
  document.body.appendChild(probe);
  const family = getComputedStyle(probe).fontFamily || fallback;
  probe.remove();
  return family;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // El bucket de ilustraciones tiene CORS para la web: sin esto el canvas no se puede exportar.
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error('image'));
    };
    image.src = src;
  });
}

/**
 * La invitación gratis para WhatsApp (DECISIONS 356): la imagen 4:5 con la franja de StoryNido, armada
 * en el navegador (sin IA ni servidor). En el celular abre el menú de compartir con la imagen; en la
 * compu la descarga. Al pagar, la del kit sale sin franja.
 */
export function FreeInvitationShare({
  book,
  childName,
  artUrl,
}: {
  book: WizardData['book'];
  childName: string;
  artUrl: string;
}) {
  const t = useTranslations('Wizard.partyPreview');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const event = book.event;
  const language = book.language;
  const copy = invitationCopy(language, event?.type, event?.tone);

  async function render(): Promise<File> {
    const art = await loadImage(artUrl);
    await document.fonts.ready;
    const canvas = document.createElement('canvas');
    canvas.width = FREE_INVITATION_SIZE.width;
    canvas.height = FREE_INVITATION_SIZE.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    const date = event?.date
      ? new Intl.DateTimeFormat(language, { dateStyle: 'full', timeZone: 'UTC' }).format(
          new Date(`${event.date}T00:00:00Z`),
        )
      : null;
    const time = formatEventTime(language, event?.startTime, event?.endTime);
    const details = [
      date ? { label: t('free.when'), value: date } : null,
      time ? { label: t('free.time'), value: time } : null,
      event?.place ? { label: t('free.where'), value: event.place } : null,
    ].filter((row): row is { label: string; value: string } => row !== null);
    drawFreeInvitation(
      ctx,
      art,
      {
        heading:
          event?.type === 'birthday' && event.turningAge
            ? t('turning', { name: childName, age: event.turningAge })
            : childName,
        invite: copy.invite,
        details,
        brand: t('free.brand'),
      },
      {
        display: cssFont('--font-display', 'system-ui, sans-serif'),
        body: cssFont('--font-sans', 'system-ui, sans-serif'),
      },
    );
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
    if (!blob) throw new Error('blob');
    const slug = childName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return new File([blob], `invitacion-${slug || 'fiesta'}.png`, { type: 'image/png' });
  }

  function download(file: File) {
    const href = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = href;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => {
      URL.revokeObjectURL(href);
    }, 10_000);
  }

  async function run(mode: 'share' | 'download') {
    setBusy(true);
    setFailed(false);
    try {
      const file = await render();
      const canShareFile =
        mode === 'share' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] });
      if (canShareFile) {
        await navigator.share({ files: [file] }).catch(() => undefined);
      } else {
        download(file);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-foreground">{t('free.lead')}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void run('share')} disabled={busy}>
          <MessageCircle aria-hidden="true" />
          {t('free.share')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void run('download')}
          disabled={busy}
        >
          <Download aria-hidden="true" />
          {t('free.download')}
        </Button>
      </div>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t('free.error')}
        </p>
      )}
    </div>
  );
}

/**
 * La oferta del libro del cumpleañero, en la muestra y no como paso del creador: es un libro de
 * Familias que se compra aparte (también lo pueden comprar abuelos y tíos con el enlace).
 */
export function BirthdayBookOffer({
  book,
  childName,
  prices,
  familyPages,
}: {
  book: WizardData['book'];
  childName: string;
  prices: PriceHint | null;
  /** Páginas del libro de Familias (el cuento largo): no es el mini cuento del kit. */
  familyPages: number;
}) {
  const t = useTranslations('Wizard.partyPreview.book');
  const locale = useLocale() as Locale;
  const [choice, setChoice] = useState<BirthdayBookChoice>(book.event?.bookChoice ?? 'none');
  const money = (minor: number | null | undefined) =>
    prices && minor != null ? formatPrice(minor, prices.currency, locale, prices.country) : null;

  function choose(value: string) {
    const next = value as BirthdayBookChoice;
    setChoice(next);
    // Es solo una preferencia: si no se guarda, no frena el pago del kit.
    void getFirebaseDb()
      .then((db) =>
        updateBook(db, book.id, {
          event: { ...EMPTY_BIRTHDAY, ...book.event, bookChoice: next },
        }),
      )
      .catch(() => undefined);
  }

  const labels: Record<BirthdayBookChoice, { name: string; price: string | null }> = {
    none: { name: t('none'), price: null },
    digital: { name: t('digital'), price: money(prices?.digitalMinor) },
    printed: { name: t('printed'), price: money(prices?.printedFromMinor) },
  };

  return (
    <section
      aria-labelledby="birthday-book"
      className="grid gap-4 rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6"
    >
      <div>
        <h2 id="birthday-book" className="text-xl font-medium">
          {t('title', { name: childName })}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('text', { pages: familyPages })}</p>
      </div>
      <fieldset>
        <legend className="sr-only">{t('title', { name: childName })}</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {BIRTHDAY_BOOK_CHOICES.map((value) => (
            <OptionCard
              key={value}
              name="birthday-book"
              value={value}
              checked={choice === value}
              onSelect={choose}
            >
              <span className="grid gap-1 p-4">
                <span className="font-semibold">{labels[value].name}</span>
                {labels[value].price && (
                  <span className="pr-6 text-sm tabular-nums">
                    {value === 'digital'
                      ? t('priceDigital', { price: labels[value].price })
                      : t('pricePrinted', { price: labels[value].price })}
                  </span>
                )}
              </span>
            </OptionCard>
          ))}
        </div>
      </fieldset>
      {choice !== 'none' && (
        <p role="status" className="text-sm">
          {t('afterKit')}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <p className="text-sm font-semibold">{t('shareLead')}</p>
        <ShareButton
          text={t('shareText', { name: childName })}
          url={getPathname({ href: '/families', locale })}
          campaign="invitacion-fiesta"
          label={t('share')}
          copyLabel={t('copyLink')}
          copiedLabel={t('copied')}
        />
      </div>
    </section>
  );
}
