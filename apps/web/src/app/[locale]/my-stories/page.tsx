import { Suspense } from 'react';

import type { Locale } from '@storynido/shared';

import { MyStories, MyStoriesSkeleton } from '@/components/account/library/my-stories';
import { homeLineCopy } from '@/components/home/session/line-copy';
import { getStories } from '@/lib/server/api';

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * Mis cuentos: la biblioteca de quien tiene sesión (auditoría UX, DECISIONS 110). «Lo próximo»
 * arriba y solapas por estado (`?estado=`): En creación, En curso, Terminados (un estante) y los
 * personajes. El catálogo y los nombres de las líneas vienen del servidor (las portadas de los
 * borradores sin muestra usan la de su historia, como en la home).
 */
export default async function MyStoriesPage({ params }: Props) {
  const locale = (await params).locale as Locale;
  const [stories, lines] = await Promise.all([getStories(locale).catch(() => []), homeLineCopy()]);
  // useSearchParams pide un límite de Suspense para poder prerenderizar la página.
  return (
    <Suspense fallback={<MyStoriesSkeleton />}>
      <MyStories stories={stories} lines={lines} />
    </Suspense>
  );
}
