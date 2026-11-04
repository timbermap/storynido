import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { NewChoice, NewChoiceWithCharacter } from '@/components/wizard/new-choice';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const t = await getTranslations({
    locale: (await params).locale,
    namespace: 'Account.myStories',
  });
  return { title: t('newTitle'), robots: { index: false } };
}

const characterId = (value: string | undefined) =>
  value && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null;

/**
 * Selector de línea antes del creador; se saltea si ya se sabe qué quiere crear. Con `?personaje=`
 * («Crear otro cuento con…») ofrece lo que se puede hacer con ese personaje y lo lleva elegido.
 */
export default async function NewPage({
  searchParams,
}: {
  searchParams: Promise<{ personaje?: string }>;
}) {
  const t = await getTranslations('Account.myStories');
  const character = characterId((await searchParams).personaje);
  return (
    <section className="container-page grid max-w-3xl gap-6 py-14">
      {character ? (
        <NewChoiceWithCharacter characterId={character} />
      ) : (
        <>
          <h1 className="text-3xl font-medium sm:text-4xl">{t('newTitle')}</h1>
          <NewChoice />
        </>
      )}
    </section>
  );
}
