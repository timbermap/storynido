import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

import { COLLECTIONS } from '@storynido/shared';

import { api } from '@/lib/api';
import type { HomeBook, HomeChannel, HomeOrder, HomeProject } from '@/lib/home-state';

import { isEmptyDraft, listDrafts, listProjects } from './drafts';

type Timestampish = { toDate(): Date } | null | undefined;

export const channelOf = (value: unknown): HomeChannel =>
  value === 'events' || value === 'professionals' ? value : 'families';

export async function childOf(
  db: Firestore,
  bookId: string,
): Promise<{ childId: string | null; childName: string | null; storyId: string | null }> {
  const book = await getDoc(doc(db, COLLECTIONS.books, bookId)).catch(() => null);
  const childId = (book?.get('childId') as string | null | undefined) ?? null;
  const storyId = (book?.get('storyId') as string | null | undefined) ?? null;
  if (!childId) return { childId: null, childName: null, storyId };
  const child = await getDoc(doc(db, COLLECTIONS.children, childId)).catch(() => null);
  return { childId, childName: (child?.get('name') as string | undefined) ?? null, storyId };
}

/** Portada y título de un libro (la API firma las imágenes; solo para quien es su dueño). */
export async function previewOf(bookId: string) {
  return api('bookPreview', { params: { bookId } }).catch(() => null);
}

/** Perfil y descuento Pro (de la API); null si no se pudo leer. */
export type HomePro = Awaited<ReturnType<typeof api<'proStatus'>>> | null;

export interface HomeData {
  books: HomeBook[];
  orders: HomeOrder[];
  /** Proyectos profesionales por niño (solo si la cuenta tiene alguno; null si no se pudieron leer). */
  projects: HomeProject[] | null;
  pro: HomePro;
}

/** Perfil profesional activado: tipo de cuenta profesional o perfil con profesión. */
export const hasProProfile = (pro: HomePro) =>
  pro !== null && (pro.accountType === 'professional' || pro.proProfile !== null);

/**
 * Lo que la home con sesión necesita saber: los cuentos sin comprar (con su etapa), los pedidos,
 * los proyectos profesionales y el perfil Pro. Solo lee lo propio, con la sesión de la persona
 * (reglas de Firestore y API). A las muestras listas les pide a la API su etapa y su portada; es
 * un puñado de libros como mucho.
 */
export async function loadHomeData(db: Firestore, uid: string): Promise<HomeData> {
  const [drafts, orderDocs, pro] = await Promise.all([
    listDrafts(db, uid).then((all) => all.filter((draft) => !isEmptyDraft(draft))),
    getDocs(
      query(
        collection(db, COLLECTIONS.orders),
        where('ownerUid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(10),
      ),
    ),
    // Sin la API la home sigue igual, sin las pistas del perfil Pro.
    api('proStatus').catch(() => null),
  ]);

  const recentReady = drafts
    .filter((draft) => draft.status === 'preview_ready')
    .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
    .slice(0, 3);
  const previews = new Map(
    await Promise.all(
      recentReady.map(async (draft) => [draft.id, await previewOf(draft.id)] as const),
    ),
  );

  const books: HomeBook[] = drafts.map((draft) => {
    const preview = previews.get(draft.id)?.preview ?? null;
    let stage: HomeBook['stage'] = 'draft';
    if (draft.generating) stage = 'generating';
    else if (draft.status === 'preview_ready' && preview) {
      stage =
        preview.stage === 'character' && preview.character?.approved !== true
          ? 'character'
          : 'preview';
    }
    return {
      id: draft.id,
      channel: draft.channel,
      childName: draft.childName,
      title: preview?.title ?? null,
      coverUrl: preview?.coverUrl ?? null,
      storyId: draft.storyId,
      characterUrl: preview?.character?.imageUrl ?? null,
      totalPages: preview?.totalPages ?? null,
      eventTheme: draft.eventTheme,
      stage,
      updatedAt: draft.updatedAt?.getTime() ?? 0,
    };
  });

  const orders: HomeOrder[] = await Promise.all(
    orderDocs.docs.map(async (order, index) => {
      const bookId = order.get('bookId') as string;
      const created = (order.get('createdAt') as Timestampish)?.toDate().getTime() ?? 0;
      const items = (order.get('items') as { format: string }[] | undefined) ?? [];
      const shipping = order.get('priceSnapshot.shipping') as
        { etaDaysMin?: number; etaDaysMax?: number; pending?: boolean } | undefined;
      const day = 24 * 60 * 60 * 1000;
      const hasEta =
        shipping !== undefined &&
        shipping.pending !== true &&
        typeof shipping.etaDaysMin === 'number' &&
        typeof shipping.etaDaysMax === 'number';
      const { childId, childName, storyId } = await childOf(db, bookId);
      // Solo los dos pedidos más recientes necesitan portada para mostrarse.
      const preview = index < 2 ? await previewOf(bookId) : null;
      return {
        id: order.id,
        bookId,
        channel: channelOf(order.get('channel')),
        childName,
        childId,
        storyId,
        title: (order.get('bookTitle') as string | undefined) ?? preview?.preview?.title ?? null,
        coverUrl: preview?.preview?.coverUrl ?? null,
        characterUrl: preview?.preview?.character?.imageUrl ?? null,
        status: order.get('status') as string,
        print: items.some((item) => item.format !== 'digital' && item.format !== 'card'),
        createdAt: created,
        etaFrom: hasEta ? created + (shipping.etaDaysMin ?? 0) * day : null,
        etaTo: hasEta ? created + (shipping.etaDaysMax ?? 0) * day : null,
      };
    }),
  );

  // Las filas profesionales van por niño, con su alias (como en Mis cuentos).
  const hasPro = [...books, ...orders].some((item) => item.channel === 'professionals');
  const projects = hasPro
    ? await listProjects(db, uid)
        .then((found) =>
          found.map((project) => ({
            childId: project.childId,
            label: project.label,
            books: project.books.map((book) => ({
              id: book.id,
              status: book.status,
              storyId: book.storyId,
              settings: book.settings,
              updatedAt: book.updatedAt?.getTime() ?? 0,
            })),
          })),
        )
        .catch(() => null)
    : [];
  return { books, orders, projects, pro };
}
