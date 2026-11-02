import {
  christmasTarget,
  lastOrderDay,
  type CountryCode,
  type Locale,
  type Offer,
} from '@storynido/shared';
import { getTranslations } from 'next-intl/server';

import { countryName } from '@/lib/country-names';

/** Desde cuándo se avisa de la fecha límite (los pedidos de octubre llegan de sobra). */
const FIRST_DAY = { month: 9, day: 15 };

/**
 * «Para Navidad»: hasta qué día hay que pedir el impreso para que llegue antes del 24 de diciembre
 * en el país elegido (producción + el peor caso de envío). Solo aparece de mediados de octubre al 23
 * de diciembre y solo si ahí hay impreso; después, el libro digital sigue disponible.
 */
export async function ChristmasDeadline({
  offer,
  country,
  locale,
  now = new Date(),
  variant = 'box',
}: {
  offer: Offer | null;
  country: CountryCode;
  locale: Locale;
  now?: Date;
  /** `line`: una línea de texto discreta (bajo el botón del hero con sesión). */
  variant?: 'box' | 'line';
}) {
  const printed = offer?.formats.some((format) => format.format !== 'digital') ?? false;
  if (!offer?.available || !printed) return null;
  const year = now.getUTCFullYear();
  const from = new Date(Date.UTC(year, FIRST_DAY.month, FIRST_DAY.day));
  const to = new Date(`${christmasTarget(year)}T00:00:00Z`);
  if (now < from || now >= to) return null;

  const t = await getTranslations('Stories');
  const last = lastOrderDay(christmasTarget(year), offer.shipping.etaDaysMax);
  const date = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(last);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const open = today <= last;
  const text = open
    ? t('christmasOpen', { date, country: countryName(country, locale) })
    : t('christmasClosed', { country: countryName(country, locale) });
  if (variant === 'line') {
    return (
      <p className="text-sm text-muted-foreground" role="note">
        {text}
      </p>
    );
  }
  return (
    <p
      className="rounded-xl bg-peach/50 px-4 py-3 text-sm font-semibold text-[#7a2f23]"
      role="note"
    >
      {text}
    </p>
  );
}
