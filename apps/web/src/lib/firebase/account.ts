import { COLLECTIONS, type BookFormat, type OrderStatus } from '@storynido/shared';
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';

export interface OrderSummary {
  id: string;
  bookId: string;
  title: string | null;
  status: OrderStatus;
  items: { format: BookFormat; quantity: number }[];
  createdAt: Date | null;
}

export interface ChildSummary {
  id: string;
  name: string;
  age: number | null;
}

type Timestampish = { toDate(): Date } | null | undefined;

/** Pedidos de la cuenta, en vivo (las reglas solo dejan leer los propios). */
export function subscribeOrders(
  db: Firestore,
  uid: string,
  onChange: (orders: OrderSummary[]) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(
      collection(db, COLLECTIONS.orders),
      where('ownerUid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(30),
    ),
    (snapshot) => {
      onChange(
        snapshot.docs.map((order) => ({
          id: order.id,
          bookId: order.get('bookId') as string,
          title: (order.get('bookTitle') as string | undefined) ?? null,
          status: order.get('status') as OrderStatus,
          items: (order.get('items') as OrderSummary['items'] | undefined) ?? [],
          createdAt: (order.get('createdAt') as Timestampish)?.toDate() ?? null,
        })),
      );
    },
    onError,
  );
}

export async function listChildren(db: Firestore, uid: string): Promise<ChildSummary[]> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.children),
      where('ownerUid', '==', uid),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snapshot.docs.map((child) => ({
    id: child.id,
    name: child.get('name') as string,
    age: (child.get('age') as number | null | undefined) ?? null,
  }));
}
