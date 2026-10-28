'use client';

import {
  BOOK_FORMATS,
  CHANNELS,
  COUNTRY_CODES,
  ORDER_STATUSES,
  type OrderStatus,
} from '@storynido/shared';
import { useCallback, useState } from 'react';

import { OrderTable } from '@/components/orders/order-table';
import { Notice, PageHeader } from '@/components/ui/page-header';
import { STATUS_LABEL } from '@/components/ui/status';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';

const selectClass = 'h-9 rounded-md border bg-background px-2 text-sm';

interface Filters {
  status: OrderStatus | '';
  country: string;
  channel: string;
  format: string;
  from: string;
  to: string;
  q: string;
}

const EMPTY: Filters = {
  status: '',
  country: '',
  channel: '',
  format: '',
  from: '',
  to: '',
  q: '',
};

/** Pedidos: búsqueda por número o email y filtros por estado, país, canal, formato y fechas. */
export default function OrdersPage() {
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const load = useCallback(
    () =>
      api('adminOrders', {
        query: {
          limit: 100,
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.country ? { country: filters.country } : {}),
          ...(filters.channel ? { channel: filters.channel } : {}),
          ...(filters.format ? { format: filters.format } : {}),
          ...(filters.from ? { from: `${filters.from}T00:00:00.000Z` } : {}),
          ...(filters.to ? { to: `${filters.to}T23:59:59.999Z` } : {}),
          ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
        },
      }),
    [filters],
  );
  const { data, error } = useApi(load);
  const set = (key: keyof Filters, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <>
      <PageHeader title="Pedidos" text="Filtros en una fila; el detalle tiene las acciones." />
      <form
        className="mb-4 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters(draft);
        }}
      >
        <input
          aria-label="Número de pedido o email del cliente"
          placeholder="Número o email"
          className="h-9 w-56 rounded-md border bg-background px-2 text-sm"
          value={draft.q}
          onChange={(event) => {
            set('q', event.target.value);
          }}
        />
        <select
          aria-label="Estado"
          className={selectClass}
          value={draft.status}
          onChange={(event) => {
            set('status', event.target.value);
          }}
        >
          <option value="">Todos los estados</option>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
        <select
          aria-label="País"
          className={selectClass}
          value={draft.country}
          onChange={(event) => {
            set('country', event.target.value);
          }}
        >
          <option value="">Todos los países</option>
          {COUNTRY_CODES.map((code) => (
            <option key={code}>{code}</option>
          ))}
        </select>
        <select
          aria-label="Canal"
          className={selectClass}
          value={draft.channel}
          onChange={(event) => {
            set('channel', event.target.value);
          }}
        >
          <option value="">Todos los canales</option>
          {CHANNELS.map((channel) => (
            <option key={channel}>{channel}</option>
          ))}
        </select>
        <select
          aria-label="Formato"
          className={selectClass}
          value={draft.format}
          onChange={(event) => {
            set('format', event.target.value);
          }}
        >
          <option value="">Todos los formatos</option>
          {BOOK_FORMATS.map((format) => (
            <option key={format}>{format}</option>
          ))}
        </select>
        <input
          type="date"
          aria-label="Desde"
          className={selectClass}
          value={draft.from}
          onChange={(event) => {
            set('from', event.target.value);
          }}
        />
        <input
          type="date"
          aria-label="Hasta"
          className={selectClass}
          value={draft.to}
          onChange={(event) => {
            set('to', event.target.value);
          }}
        />
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground"
        >
          Buscar
        </button>
        <button
          type="button"
          className="h-9 px-2 text-sm text-muted-foreground underline"
          onClick={() => {
            setDraft(EMPTY);
            setFilters(EMPTY);
          }}
        >
          Limpiar
        </button>
      </form>
      {error && <Notice tone="error">{error}</Notice>}
      {data && <OrderTable orders={data.orders} />}
    </>
  );
}
