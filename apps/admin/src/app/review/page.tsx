'use client';

import { useCallback } from 'react';

import { OrderTable } from '@/components/orders/order-table';
import { Notice, PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';

/** Cola de revisión manual: pedidos que fallaron el control de calidad o un paso. */
export default function ReviewPage() {
  const load = useCallback(() => api('adminReviewQueue'), []);
  const { data, error } = useApi(load);
  return (
    <>
      <PageHeader
        title="Revisión manual"
        text="Abre el pedido para ver las páginas y aprobar, reintentar o regenerar. Sin datos del niño."
      />
      {error && <Notice tone="error">{error}</Notice>}
      {data && (
        <OrderTable
          orders={data.orders}
          extra={{
            label: 'Motivo',
            render: (order) => {
              const codes = (order as typeof order & { qaCodes?: string[] }).qaCodes ?? [];
              return (
                <span className="text-xs">
                  <span className="font-mono">{order.failedStep ?? '—'}</span>
                  {codes.length > 0 && (
                    <span className="text-muted-foreground"> · {codes.join(', ')}</span>
                  )}
                </span>
              );
            },
          }}
        />
      )}
    </>
  );
}
