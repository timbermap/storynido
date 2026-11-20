'use client';

import { useCallback } from 'react';

import { AreaPage } from '@/components/areas/area-page';
import { api } from '@/lib/api';
import { attentionFor, daysAgo } from '@/lib/area-data';
import { useApi } from '@/lib/use-api';

const TYPES: Record<string, string> = {
  families: 'Familias',
  events: 'Celebraciones',
  professionals: 'Profesionales',
};

/** Usuarios: quiénes se registran, cotizaciones pendientes y quién entra al panel. */
export default function UsersSummaryPage() {
  const load = useCallback(
    () =>
      Promise.all([
        api('adminCustomers', { query: {} }),
        api('adminQuoteRequests'),
        api('adminStaff'),
        api('adminAttention'),
      ]),
    [],
  );
  const { data, error } = useApi(load);
  const [customers, quotes, staff, attention] = data ?? [];
  const list = customers?.customers ?? [];
  const byType = new Map<string, number>();
  for (const customer of list)
    byType.set(customer.accountType, (byType.get(customer.accountType) ?? 0) + 1);
  return (
    <AreaPage
      area="Usuarios"
      text="Quiénes compran, qué piden y quién entra al panel."
      loaded={data !== null}
      error={error}
      attention={attentionFor('Usuarios', attention?.items)}
      stats={[
        {
          label: 'Clientes recientes',
          value: String(list.length),
          hint: 'Los últimos que la lista carga',
        },
        {
          label: 'Nuevos 7 días',
          value: String(list.filter((c) => daysAgo(c.createdAt, 7)).length),
        },
        {
          label: 'Cotizaciones nuevas',
          value: String((quotes?.requests ?? []).filter((r) => r.status === 'new').length),
        },
        { label: 'Equipo del panel', value: String(staff?.staff.length ?? 0) },
      ]}
      barsTitle="Clientes por tipo de cuenta"
      bars={[...byType.entries()].map(([type, value]) => ({ label: TYPES[type] ?? type, value }))}
    />
  );
}
