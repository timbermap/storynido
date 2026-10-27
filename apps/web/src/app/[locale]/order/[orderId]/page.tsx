import { getTranslations } from 'next-intl/server';

import type { Locale } from '@storynido/shared';

import { OrderStatus } from '@/components/checkout/order-status';
import { getDisplayCountry } from '@/lib/server/request-context';

interface Props {
  params: Promise<{ locale: string; orderId: string }>;
}

/** A esta página vuelve el pago: muestra el estado del pedido en vivo. */
export default async function OrderPage({ params }: Props) {
  const { locale, orderId } = await params;
  const [t, display] = await Promise.all([
    getTranslations('Checkout.order'),
    getDisplayCountry(locale as Locale),
  ]);
  return (
    <section className="container-page max-w-5xl py-10 lg:py-14">
      <h1 className="text-[clamp(2rem,4vw,3rem)] leading-tight font-medium">{t('title')}</h1>
      <div className="mt-8">
        <OrderStatus orderId={orderId} country={display.country} />
      </div>
    </section>
  );
}
