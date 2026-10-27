import type { Locale } from '@storynido/shared';

import { Wizard } from '@/components/wizard/wizard';
import { getEditorial, getLessons, getStories, getStyles } from '@/lib/server/api';

interface Props {
  params: Promise<{ locale: string; bookId: string }>;
}

/** El catálogo se carga en el servidor; el borrador, en el cliente (Firestore en vivo). */
export default async function WizardPage({ params }: Props) {
  const { locale: rawLocale, bookId } = await params;
  const locale = rawLocale as Locale;
  const [stories, lessons, styles, editorial] = await Promise.all([
    getStories(locale),
    getLessons(locale),
    getStyles(locale),
    getEditorial(),
  ]);
  return <Wizard bookId={bookId} catalog={{ stories, lessons, styles, editorial }} />;
}
