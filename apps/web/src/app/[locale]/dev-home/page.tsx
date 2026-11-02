import { notFound } from 'next/navigation';

import type { Locale } from '@storynido/shared';

import { AppHeader } from '@/components/layout/app-header';
import { SignedInHome } from '@/components/home/session/signed-in-home';
import type { HomeBook, HomeOrder } from '@/lib/home-state';
import { getOffer, getStories } from '@/lib/server/api';
import { getDisplayCountry } from '@/lib/server/request-context';

/**
 * Solo desarrollo: la home con sesión con datos de prueba, un estado por parámetro
 * (`?estado=nuevo|borrador|dibujando|personaje|lista|preparando|camino|compro|pro`).
 * En producción no existe.
 */
export default async function DevHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ estado?: string; header?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const locale = (await params).locale as Locale;
  const query = await searchParams;
  const estado = query.estado ?? 'nuevo';
  const display = await getDisplayCountry(locale);
  const [offer, stories] = await Promise.all([
    getOffer(display.country, locale),
    getStories(locale, undefined, { channel: 'families' }).catch(() => []),
  ]);
  const families = stories.filter((story) => story.channels[0] === 'families');
  const sample = families[0] ?? stories[0];

  const book = (over: Partial<HomeBook>): HomeBook => ({
    id: 'demo',
    channel: 'families',
    childName: 'Toto',
    title: 'Toto y el valle de los dinosaurios',
    coverUrl: sample?.coverImage ?? null,
    storyId: sample?.slug ?? null,
    characterUrl: '/images/secciones/personaje.webp',
    totalPages: 28,
    stage: 'draft',
    updatedAt: 1,
    ...over,
  });
  // Fechas fijas: la página es de prueba y así las capturas salen siempre iguales.
  const day = 24 * 3600 * 1000;
  const base = Date.UTC(2026, 10, 2);
  const order = (over: Partial<HomeOrder>): HomeOrder => ({
    id: 'demo-order',
    bookId: 'demo',
    channel: 'families',
    childName: 'Toto',
    childId: 'c1',
    title: 'Toto y el valle de los dinosaurios',
    coverUrl: sample?.coverImage ?? null,
    characterUrl: '/images/secciones/personaje.webp',
    status: 'in_production',
    print: true,
    createdAt: base - 3 * day,
    etaFrom: base + 9 * day,
    etaTo: base + 15 * day,
    ...over,
  });

  const data = {
    nuevo: { books: [], orders: [] },
    borrador: { books: [book({ stage: 'draft', coverUrl: null })], orders: [] },
    dibujando: { books: [book({ stage: 'generating', coverUrl: null })], orders: [] },
    personaje: { books: [book({ stage: 'character', coverUrl: null })], orders: [] },
    lista: { books: [book({ stage: 'preview' })], orders: [] },
    preparando: { books: [], orders: [order({ status: 'paid' })] },
    camino: { books: [], orders: [order({ status: 'shipped' })] },
    compro: { books: [], orders: [order({ status: 'delivered' })] },
    pro: { books: [book({ channel: 'professionals', stage: 'preview' })], orders: [] },
  }[estado] ?? { books: [], orders: [] };

  return (
    <>
      {/* Para ver el navbar con sesión en las capturas (el real depende de la sesión). */}
      {query.header === 'app' && <AppHeader />}
      <SignedInHome
        stories={families.length > 0 ? families : stories}
        offer={offer}
        country={display.country}
        storyCount={families.length}
        shippingEstimate={null}
        christmas={null}
        previewData={data}
      />
    </>
  );
}
