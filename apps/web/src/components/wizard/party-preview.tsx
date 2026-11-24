'use client';

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
import { getPathname } from '@/i18n/navigation';
import { getFirebaseDb } from '@/lib/firebase/client';
import { updateBook } from '@/lib/firebase/drafts';
import { formatPrice } from '@/lib/format';

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
