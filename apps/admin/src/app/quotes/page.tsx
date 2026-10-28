'use client';

import { useCallback, useState } from 'react';

import { Card, Notice, PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { errorMessage, useApi } from '@/lib/use-api';

const STATUSES = { new: 'Nueva', contacted: 'Contactada', closed: 'Cerrada' } as const;
type Status = keyof typeof STATUSES;

/** "Pedir cotización" de Eventos: impresos que todavía no ofrece ninguna imprenta. */
export default function QuotesPage() {
  const load = useCallback(() => api('adminQuoteRequests'), []);
  const { data, error, reload } = useApi(load);
  const [message, setMessage] = useState<string | null>(null);

  async function update(id: string, status: Status, note: string | null) {
    try {
      await api('adminUpdateQuoteRequest', { params: { id }, body: { status, note } });
      setMessage(null);
      await reload();
    } catch (caught) {
      setMessage(errorMessage(caught));
    }
  }

  return (
    <>
      <PageHeader
        title="Cotizaciones de Eventos"
        text="Cada cambio de estado queda en la auditoría."
      />
      {(error ?? message) && <Notice tone="error">{error ?? message}</Notice>}
      {data?.requests.length === 0 && <Notice>No hay pedidos de cotización.</Notice>}
      <div className="grid gap-3">
        {data?.requests.map((request) => (
          <Card key={request.id} className="grid gap-2">
            <p className="flex flex-wrap justify-between gap-2 text-sm">
              <span className="font-medium">
                {request.email ?? 'sin email'} · {request.country} · {request.pieces.join(', ')} ×{' '}
                {request.copies}
              </span>
              <span className="text-xs text-muted-foreground">
                {request.createdAt ? new Date(request.createdAt).toLocaleString('es') : ''}
              </span>
            </p>
            {request.message && <p className="text-sm text-muted-foreground">{request.message}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Estado"
                className="h-8 rounded-md border bg-background px-2 text-sm"
                value={request.status}
                onChange={(event) =>
                  void update(request.id, event.target.value as Status, request.note)
                }
              >
                {(Object.keys(STATUSES) as Status[]).map((status) => (
                  <option key={status} value={status}>
                    {STATUSES[status]}
                  </option>
                ))}
              </select>
              <input
                aria-label="Nota interna"
                placeholder="Nota interna (al salir del campo se guarda)"
                defaultValue={request.note ?? ''}
                className="h-8 min-w-64 flex-1 rounded-md border bg-background px-2 text-sm"
                onBlur={(event) => {
                  const note = event.target.value.trim() || null;
                  if (note !== request.note) void update(request.id, request.status, note);
                }}
              />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
