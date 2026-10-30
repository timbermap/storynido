'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

import { Notice, PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { useApi } from '@/lib/use-api';

/** Clientes: los más recientes o uno por email. De los chicos, solo la cantidad. */
export default function CustomersPage() {
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const load = useCallback(() => api('adminCustomers', { query: q ? { q } : {} }), [q]);
  const { data, error } = useApi(load);
  return (
    <>
      <PageHeader
        title="Clientes"
        text="Historial de compras, descuento por volumen y borrado de datos a pedido."
      />
      <form
        className="mb-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setQ(draft.trim());
        }}
      >
        <input
          aria-label="Email del cliente"
          placeholder="Email del cliente"
          className="h-9 w-72 rounded-md border bg-background px-2 text-sm"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
        />
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground"
        >
          Buscar
        </button>
      </form>
      {error && <Notice tone="error">{error}</Notice>}
      {data && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Alta</th>
                <th className="px-3 py-2">Cuenta</th>
                <th className="px-3 py-2">Compras</th>
                <th className="px-3 py-2">Gastado</th>
                <th className="px-3 py-2">Chicos</th>
              </tr>
            </thead>
            <tbody>
              {data.customers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-muted-foreground">
                    Sin resultados.
                  </td>
                </tr>
              )}
              {data.customers.map((customer) => (
                <tr key={customer.uid} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <Link href={`/customer?uid=${customer.uid}`} className="text-primary underline">
                      {customer.email ?? customer.uid}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {customer.createdAt
                      ? new Date(customer.createdAt).toLocaleDateString('es')
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {customer.accountType}
                    {customer.role !== 'customer' ? ` · ${customer.role}` : ''}
                  </td>
                  <td className="px-3 py-2">{customer.orders}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {Object.entries(customer.spentByCurrency)
                      .map(([currency, minor]) => money(minor, currency))
                      .join(' · ') || '—'}
                  </td>
                  <td className="px-3 py-2">{customer.children}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
