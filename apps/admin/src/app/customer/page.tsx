'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';

import { OrderTable } from '@/components/orders/order-table';
import { Button } from '@/components/ui/button';
import { Card, Notice, PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { errorMessage, useApi } from '@/lib/use-api';

function CustomerDetail({ uid }: { uid: string }) {
  const load = useCallback(() => api('adminCustomerDetail', { params: { uid } }), [uid]);
  const { data, error, reload } = useApi(load);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function erase() {
    if (
      !window.confirm(
        'Se borran las fotos, los perfiles de los chicos y los borradores. Se conservan la cuenta y los pedidos (facturación). ¿Continuar?',
      )
    )
      return;
    try {
      const result = await api('adminEraseCustomerData', { params: { uid } });
      setMessage({
        text: `Borrado: ${String(result.children)} perfiles, ${String(result.photos)} fotos y ${String(result.books)} borradores (se conservaron ${String(result.keptOrderedBooks)} libros pedidos). Quedó la constancia.`,
        error: false,
      });
      await reload();
    } catch (caught) {
      setMessage({ text: errorMessage(caught), error: true });
    }
  }

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <p role="status">Cargando…</p>;
  return (
    <>
      <PageHeader
        title={data.email ?? data.uid}
        text={`Cuenta ${data.accountType} · ${String(data.orders)} compras · ${String(data.children)} perfiles de chicos`}
      />
      {message && (
        <div className="mb-4">
          <Notice tone={message.error ? 'error' : 'info'}>{message.text}</Notice>
        </div>
      )}
      {data.pro && (
        <Card className="mb-4">
          <h2 className="font-semibold">Profesional</h2>
          <p className="mt-1 text-sm">
            {data.pro.purchases} compras elegibles en {data.pro.windowDays} días · descuento{' '}
            {data.pro.digitalPercent} % digital y {data.pro.printPercent} % impreso.
          </p>
        </Card>
      )}
      <h2 className="mb-2 font-semibold">Pedidos</h2>
      <OrderTable orders={data.ordersList} />
      <Card className="mt-6">
        <h2 className="font-semibold">Privacidad</h2>
        {data.privacyRequests.length > 0 ? (
          <ul className="mt-2 text-sm">
            {data.privacyRequests.map((request, index) => (
              <li key={index}>
                {request.completedAt ? new Date(request.completedAt).toLocaleString('es') : '—'} ·{' '}
                {request.requestedBy ?? '—'} ·{' '}
                {Object.entries(request.result)
                  .map(([key, value]) => `${key}: ${String(value)}`)
                  .join(', ')}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Sin pedidos de borrado.</p>
        )}
        <Button variant="destructive" className="mt-3" onClick={() => void erase()}>
          Borrar datos de los chicos a pedido
        </Button>
      </Card>
    </>
  );
}

function Inner() {
  const uid = useSearchParams().get('uid');
  if (!uid) return <Notice tone="error">Falta el cliente.</Notice>;
  return <CustomerDetail uid={uid} />;
}

export default function CustomerPage() {
  return (
    <Suspense fallback={<p role="status">Cargando…</p>}>
      <Inner />
    </Suspense>
  );
}
