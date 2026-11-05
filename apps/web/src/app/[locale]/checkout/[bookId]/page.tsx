import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { CardsCheckout } from '@/components/checkout/cards-checkout';
import { Checkout } from '@/components/checkout/checkout';
import { KitCheckout } from '@/components/checkout/kit-checkout';
import { getOffer } from '@/lib/server/api';
import { getDisplayCountry } from '@/lib/server/request-context';

interface Props {
  params: Promise<{ locale: string; bookId: string }>;
  searchParams: Promise<{ reorder?: string; kit?: string; cards?: string }>;
}

/** Pago del libro: los formatos y precios del país salen del catálogo; el total, de la API. */
export default async function CheckoutPage({ params, searchParams }: Props) {
  const [{ locale: rawLocale, bookId }, { reorder, kit, cards }] = await Promise.all([
    params,
    searchParams,
  ]);
  const locale = rawLocale as Locale;
  const display = await getDisplayCountry(locale);
  const [t, offer] = await Promise.all([
    getTranslations('Checkout'),
    getOffer(display.country, locale),
  ]);
  return (
    <section className="container-page max-w-5xl py-10 lg:py-14">
      <h1 className="text-[clamp(2rem,4vw,3rem)] leading-tight font-medium">
        {cards ? t('kit.printCards.title') : kit ? t('kit.title') : t('title')}
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        {cards
          ? t('kit.printCards.subtitle')
          : kit
            ? t('kit.subtitle')
            : reorder
              ? t('reorderSubtitle')
              : t('subtitle')}
      </p>
      <div className="mt-8">
        {cards ? (
          <CardsCheckout sourceOrderId={cards} country={display.country} />
        ) : kit ? (
          <KitCheckout bookId={bookId} country={display.country} reorderOf={reorder ?? null} />
        ) : offer?.available ? (
          <Checkout
            bookId={bookId}
            offer={offer}
            country={display.country}
            reorderOf={reorder ?? null}
          />
        ) : (
          <p className="rounded-2xl border bg-card p-6">{t('unavailable')}</p>
        )}
      </div>
    </section>
  );
}
