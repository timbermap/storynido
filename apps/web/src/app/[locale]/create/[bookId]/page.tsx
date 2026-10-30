import type { Locale } from '@storynido/shared';

import { Wizard } from '@/components/wizard/wizard';
import { loadWizardCatalog } from '@/lib/server/wizard-catalog';

interface Props {
  params: Promise<{ locale: string; bookId: string }>;
}

/** El catálogo se carga en el servidor; el borrador, en el cliente (Firestore en vivo). */
export default async function WizardPage({ params }: Props) {
  const { locale, bookId } = await params;
  return <Wizard bookId={bookId} catalog={await loadWizardCatalog(locale as Locale)} />;
}
