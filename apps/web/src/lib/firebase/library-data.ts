import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

import { COLLECTIONS } from '@storynido/shared';

import type { HomeBook, HomeOrder } from '@/lib/home-state';
import type { LibraryOrder } from '@/lib/library';

import { listChildren, type ChildSummary } from './account';
import { isEmptyDraft, listDrafts } from './drafts';
import { channelOf, childOf, previewOf } from './home-data';

type Timestampish = { toDate(): Date } | null | undefined;

/** Pedidos con portada generada (los demás usan la de su historia del catálogo). */
const COVERS = 12;
const DAY = 24 * 60 * 60 * 1000;

export interface LibraryData {
  books: HomeBook[];
  orders: LibraryOrder[];
  children: ChildSummary[];
}

/**
 * Lo que necesita Mis cuentos: los borradores (con su etapa y portada), los pedidos (con formato,
 * portada y la ventana de entrega si el pedido la trae) y los personajes. Solo lo propio, con la
 * sesión de la persona. Como la home, pide a la API la portada de las muestras listas.
 */
export async function loadLibraryData(db: Firestore, uid: string): Promise<LibraryData> {
  const [drafts, orderDocs, children] = await Promise.all([
    listDrafts(db, uid).then((all) => all.filter((draft) => !isEmptyDraft(draft))),
    getDocs(
      query(
        collection(db, COLLECTIONS.orders),
        where('ownerUid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(30),
      ),
    ),
    listChildren(db, uid).catch(() => []),
  ]);

  const previews = new Map(
    await Promise.all(
      drafts
        .filter((draft) => draft.status === 'preview_ready')
        .slice(0, COVERS)
        .map(async (draft) => [draft.id, await previewOf(draft.id)] as const),
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

  const orders: LibraryOrder[] = await Promise.all(
    orderDocs.docs
      // Los pagos que nunca se completaron no son pedidos para quien compra.
      .filter((order) => order.get('status') !== 'pending_payment')
      .map(async (order, index) => {
        const bookId = order.get('bookId') as string;
        const created = (order.get('createdAt') as Timestampish)?.toDate().getTime() ?? 0;
        const items = (order.get('items') as LibraryOrder['items'] | undefined) ?? [];
        const shipping = order.get('priceSnapshot.shipping') as
          { etaDaysMin?: number; etaDaysMax?: number; pending?: boolean } | undefined;
        const hasEta =
          shipping !== undefined &&
          shipping.pending !== true &&
          typeof shipping.etaDaysMin === 'number' &&
          typeof shipping.etaDaysMax === 'number' &&
          shipping.etaDaysMax > 0;
        const [{ childId, childName, storyId }, preview] = await Promise.all([
          childOf(db, bookId),
          index < COVERS ? previewOf(bookId) : Promise.resolve(null),
        ]);
        const base: HomeOrder = {
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
          etaFrom: hasEta ? created + (shipping.etaDaysMin ?? 0) * DAY : null,
          etaTo: hasEta ? created + (shipping.etaDaysMax ?? 0) * DAY : null,
        };
        return { ...base, items };
      }),
  );

  return { books, orders, children };
}
