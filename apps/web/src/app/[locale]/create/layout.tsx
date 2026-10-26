import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'Wizard' });
  // Páginas privadas del creador: fuera de los buscadores.
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

export default function CreateLayout({ children }: { children: ReactNode }) {
  return children;
}
