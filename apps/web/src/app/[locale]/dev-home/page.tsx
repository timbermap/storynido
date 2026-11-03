import { notFound } from 'next/navigation';

import type { Locale } from '@storynido/shared';

import { AppHeader } from '@/components/layout/app-header';
import { homeLineCopy } from '@/components/home/session/line-copy';
import { SignedInHome, type HomePreview } from '@/components/home/session/signed-in-home';
import type { HomePro } from '@/lib/firebase/home-data';
import type { HomeBook, HomeOrder, HomeProject } from '@/lib/home-state';
import { getOffer, getStories } from '@/lib/server/api';
import { getDisplayCountry } from '@/lib/server/request-context';

/**
 * Solo desarrollo: la home con sesión con datos de prueba, un estado por parámetro
 * (`?estado=nuevo|nuevo-eventos|nuevo-pro|familia|eventos|pro|mixto|borrador|dibujando|personaje|
 * lista|preparando|camino|compro`). En producción no existe.
 */
export default async function DevHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ estado?: string; header?: string; nombre?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const locale = (await params).locale as Locale;
  const query = await searchParams;
  const estado = query.estado ?? 'nuevo';
  const display = await getDisplayCountry(locale);
  const [offer, stories, lines] = await Promise.all([
    getOffer(display.country, locale),
    getStories(locale).catch(() => []),
    homeLineCopy(),
  ]);
  const families = stories.filter((story) => story.channels[0] === 'families');
  const sample = families[0] ?? stories[0];
  const proStories = stories.filter((story) => story.channels.includes('professionals'));

  // Fechas fijas: la página es de prueba y así las capturas salen siempre iguales.
  const day = 24 * 3600 * 1000;
  const base = Date.UTC(2026, 10, 2);
  const book = (over: Partial<HomeBook>): HomeBook => ({
    id: 'demo',
    channel: 'families',
    childName: 'Toto',
    title: 'Toto y el valle de los dinosaurios',
    coverUrl: sample?.coverImage ?? null,
    storyId: sample?.slug ?? null,
    characterUrl: '/images/secciones/personaje.webp',
    totalPages: 28,
    eventTheme: null,
    stage: 'draft',
    updatedAt: base - day,
    ...over,
  });
  const kit = (over: Partial<HomeBook>): HomeBook =>
    book({
      id: 'demo-kit',
      channel: 'events',
      title: null,
      coverUrl: null,
      storyId: null,
      eventTheme: 'Dinosaurios',
      ...over,
    });
  const order = (over: Partial<HomeOrder>): HomeOrder => ({
    id: 'demo-order',
    bookId: 'demo-ordered',
    channel: 'families',
    childName: 'Toto',
    childId: 'c1',
    storyId: sample?.slug ?? null,
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

  const proStatus: HomePro = {
    accountType: 'professional',
    proProfile: {
      profession: 'psychologist',
      professionOther: null,
      practiceName: null,
      country: display.country,
    },
    discount: {
      windowDays: 90,
      purchases: 2,
      digitalPercent: 10,
      printPercent: 5,
      next: { purchases: 3, percent: 15 },
    },
  };
  const story = (index: number) => proStories[index]?.slug ?? stories[index]?.slug ?? null;
  const projects: HomeProject[] = [
    {
      childId: 'p1',
      label: 'Mati',
      books: [{ id: 'pro-1', status: 'preview_ready', storyId: story(0), updatedAt: base - day }],
    },
    {
      childId: 'p2',
      label: 'Lu',
      books: [{ id: 'pro-2', status: 'draft', storyId: story(1), updatedAt: base - 2 * day }],
    },
    {
      childId: 'p3',
      label: 'Benja',
      books: [{ id: 'pro-3', status: 'ordered', storyId: story(2), updatedAt: base - 5 * day }],
    },
  ];
  const proBooks = [
    book({
      id: 'pro-1',
      channel: 'professionals',
      childName: 'Matías',
      stage: 'preview',
      coverUrl: null,
      storyId: story(0),
      updatedAt: base - day,
    }),
    book({
      id: 'pro-2',
      channel: 'professionals',
      childName: 'Lucía',
      stage: 'draft',
      coverUrl: null,
      storyId: story(1),
      updatedAt: base - 2 * day,
    }),
  ];

  const empty = { books: [], orders: [], projects: [], pro: null };
  const states: Record<string, HomePreview> = {
    nuevo: empty,
    'nuevo-eventos': { ...empty, remembered: 'events' },
    'nuevo-pro': { ...empty, pro: proStatus },
    familia: { ...empty, books: [book({ stage: 'preview' })] },
    eventos: { ...empty, books: [kit({ stage: 'character' })] },
    pro: {
      books: proBooks,
      orders: [
        order({ id: 'pro-order', bookId: 'pro-3', channel: 'professionals', status: 'delivered' }),
      ],
      projects,
      pro: proStatus,
    },
    mixto: {
      ...empty,
      books: [kit({ stage: 'preview', coverUrl: '/images/heroes/kit-completo.webp' })],
      orders: [order({ status: 'shipped' })],
    },
    borrador: { ...empty, books: [book({ stage: 'draft', coverUrl: null })] },
    dibujando: { ...empty, books: [book({ stage: 'generating', coverUrl: null })] },
    personaje: { ...empty, books: [book({ stage: 'character', coverUrl: null })] },
    lista: { ...empty, books: [book({ stage: 'preview' })] },
    preparando: { ...empty, orders: [order({ status: 'paid' })] },
    camino: { ...empty, orders: [order({ status: 'shipped' })] },
    compro: { ...empty, orders: [order({ status: 'delivered' })] },
  };
  // Sin nombre (`?nombre=no`) para ver la home sin el saludo.
  const data = { name: query.nombre === 'no' ? null : 'Sebas', ...(states[estado] ?? empty) };

  return (
    <>
      {/* Para ver el navbar con sesión en las capturas (el real depende de la sesión). */}
      {query.header === 'app' && <AppHeader />}
      <SignedInHome
        key={estado}
        stories={stories}
        offer={offer}
        country={display.country}
        lines={lines}
        christmas={null}
        previewData={data}
      />
    </>
  );
}
