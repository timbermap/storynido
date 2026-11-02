import { COLLECTIONS, type BookFormat, type OrderStatus } from '@storynido/shared';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
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

export interface ChildDetails {
  name: string;
  age: number;
  pronouns: 'she' | 'he' | 'they' | null;
  likes: string[];
  petName: string | null;
  bestFriendName: string | null;
}

/** Datos completos de un perfil para su pantalla (null si no existe o no es del usuario). */
export async function getChildDetails(
  db: Firestore,
  childId: string,
): Promise<ChildDetails | null> {
  const snapshot = await getDoc(doc(db, COLLECTIONS.children, childId)).catch(() => null);
  if (!snapshot?.exists()) return null;
  return {
    name: snapshot.get('name') as string,
    age: (snapshot.get('age') as number | undefined) ?? 0,
    pronouns: (snapshot.get('pronouns') as ChildDetails['pronouns'] | undefined) ?? null,
    likes: (snapshot.get('likes') as string[] | undefined) ?? [],
    petName: (snapshot.get('petName') as string | null | undefined) ?? null,
    bestFriendName: (snapshot.get('bestFriendName') as string | null | undefined) ?? null,
  };
}

/** Guarda los datos del perfil (las reglas solo dejan tocar sus campos editables). */
export async function updateChildDetails(
  db: Firestore,
  childId: string,
  fields: ChildDetails,
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.children, childId), {
    ...fields,
    updatedAt: serverTimestamp(),
  });
}

/** Cambia el nombre y la edad de un perfil (las reglas solo dejan tocar sus campos editables). */
export async function updateChildProfile(
  db: Firestore,
  childId: string,
  fields: { name: string; age: number },
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.children, childId), {
    name: fields.name,
    age: fields.age,
    updatedAt: serverTimestamp(),
  });
}
