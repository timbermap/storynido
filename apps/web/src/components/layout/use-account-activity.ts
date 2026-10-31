'use client';

import { useEffect, useState } from 'react';

import { isPrintOrder } from '@/components/orders/timeline';
import { subscribeOrders, type OrderSummary } from '@/lib/firebase/account';
import { getFirebaseDb } from '@/lib/firebase/client';
import { isEmptyDraft, listDrafts, type DraftSummary } from '@/lib/firebase/drafts';

import { useAuth } from '@/components/auth/auth-provider';

/** Un pedido "en curso": pagado y todavía sin llegar (un digital listo ya está terminado). */
export function isOrderInProgress(order: Pick<OrderSummary, 'status' | 'items'>): boolean {
  if (['pending_payment', 'cancelled', 'refunded', 'delivered'].includes(order.status)) {
    return false;
  }
  return !(order.status === 'ready' && !isPrintOrder(order.items));
}

/** Pedidos de la cuenta, en vivo: cuántos tiene y cuántos están en curso (null mientras se lee). */
export function useOrderCounts(): { total: number; inProgress: number } | null {
  const { user, signedIn } = useAuth();
  const uid = signedIn ? (user?.uid ?? null) : null;
  const [count, setCount] = useState<{ total: number; inProgress: number } | null>(null);

  useEffect(() => {
    if (!uid) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void getFirebaseDb().then((db) => {
      if (cancelled) return;
      unsubscribe = subscribeOrders(
        db,
        uid,
        (orders) => {
          const real = orders.filter((order) => order.status !== 'pending_payment');
          setCount({ total: real.length, inProgress: real.filter(isOrderInProgress).length });
        },
        () => {
          setCount(null);
        },
      );
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [uid]);

  return count;
}

/** El borrador más reciente con algo cargado: lo que conviene retomar (undefined: leyendo). */
export function useLatestDraft(): DraftSummary | null | undefined {
  const { user, signedIn } = useAuth();
  const uid = signedIn ? (user?.uid ?? null) : null;
  const [draft, setDraft] = useState<DraftSummary | null | undefined>(undefined);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void getFirebaseDb()
      .then((db) => listDrafts(db, uid))
      .then((found) => {
        if (!cancelled) setDraft(found.find((item) => !isEmptyDraft(item)) ?? null);
      })
      .catch(() => {
        if (!cancelled) setDraft(null);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return uid ? draft : null;
}
