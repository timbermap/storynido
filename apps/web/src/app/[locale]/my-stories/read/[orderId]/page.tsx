import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { OrderReader } from '@/components/reader/order-reader';

interface Props {
  params: Promise<{ locale: string; orderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'Reader' });
  return { title: t('pageTitle'), robots: { index: false } };
}

/**
 * Leer un libro comprado en el visor, desde Terminados de Mis cuentos (DECISIONS 254) o desde
 * «Tu pedido» (?desde=pedido: la X vuelve al pedido).
 */
export default async function ReadPage({ params, searchParams }: Props) {
  const [{ orderId }, query] = await Promise.all([params, searchParams]);
  return <OrderReader orderId={orderId} fromOrder={query.desde === 'pedido'} />;
}
