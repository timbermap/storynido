import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

import { COLLECTIONS } from '@storynido/shared';

import { api } from '@/lib/api';
import type { HomeBook, HomeChannel, HomeOrder } from '@/lib/home-state';

import { isEmptyDraft, listDrafts } from './drafts';

type Timestampish = { toDate(): Date } | null | undefined;

const channelOf = (value: unknown): HomeChannel =>
  value === 'events' || value === 'professionals' ? value : 'families';

async function childOf(
  db: Firestore,
  bookId: string,
): Promise<{ childId: string | null; childName: string | null }> {
  const book = await getDoc(doc(db, COLLECTIONS.books, bookId)).catch(() => null);
  const childId = (book?.get('childId') as string | null | undefined) ?? null;
  if (!childId) return { childId: null, childName: null };
  const child = await getDoc(doc(db, COLLECTIONS.children, childId)).catch(() => null);
  return { childId, childName: (child?.get('name') as string | undefined) ?? null };
}

/** Portada y título de un libro (la API firma las imágenes; solo para quien es su dueño). */
async function previewOf(bookId: string) {
  return api('bookPreview', { params: { bookId } }).catch(() => null);
}

/**
 * Lo que la home con sesión necesita saber: los cuentos sin comprar (con su etapa) y los pedidos.
 * Solo lee lo propio, con la sesión de la persona (reglas de Firestore y API). A las muestras
 * listas les pide a la API su etapa y su portada; es un puñado de libros como mucho.
 */
export async function loadHomeData(
  db: Firestore,
  uid: string,
): Promise<{ books: HomeBook[]; orders: HomeOrder[] }> {
  const [drafts, orderDocs] = await Promise.all([
    listDrafts(db, uid).then((all) => all.filter((draft) => !isEmptyDraft(draft))),
    getDocs(
      query(
        collection(db, COLLECTIONS.orders),
        where('ownerUid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(10),
      ),
    ),
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
      const { childId, childName } = await childOf(db, bookId);
      // Solo los dos pedidos más recientes necesitan portada para mostrarse.
      const preview = index < 2 ? await previewOf(bookId) : null;
      return {
        id: order.id,
        bookId,
        channel: channelOf(order.get('channel')),
        childName,
        childId,
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
  return { books, orders };
}
