import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { NewCharacter } from '@/components/account/new-character';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const t = await getTranslations({
    locale: (await params).locale,
    namespace: 'Account.myStories.newCharacter',
  });
  return { title: t('title'), robots: { index: false } };
}

/** «Agregar a otro chico»: el personaje solo, sin cuento. */
export default function NewCharacterPage() {
  return <NewCharacter />;
}
