import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { OrderReader } from '@/components/reader/order-reader';

interface Props {
  params: Promise<{ locale: string; orderId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'Reader' });
  return { title: t('pageTitle'), robots: { index: false } };
}

/** Leer un libro comprado en el visor, desde Terminados de Mis cuentos (DECISIONS 254). */
export default async function ReadPage({ params }: Props) {
  const { orderId } = await params;
  return <OrderReader orderId={orderId} />;
}
