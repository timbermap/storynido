'use client';

import type { AdminAuditEntry } from '@storynido/shared';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, Notice, PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { errorMessage, useApi } from '@/lib/use-api';

const ENTITIES = [
  ['', 'Todo'],
  ['siteConfig', 'Sitio'],
  ['aiConfig', 'IA'],
  ['countries', 'Países'],
  ['prices', 'Precios'],
  ['coupons', 'Cupones'],
  ['promotions', 'Promociones'],
  ['eventPricing', 'Eventos'],
  ['proDiscounts', 'Profesionales'],
  ['stories', 'Historias'],
  ['collections', 'Colecciones'],
  ['illustrationStyles', 'Estilos'],
  ['lessons', 'Enseñanzas'],
  ['editorialConfig', 'Opciones editoriales'],
  ['content', 'Contenido'],
  ['orders', 'Pedidos'],
  ['users', 'Usuarios'],
] as const;

/** Qué campos cambiaron entre el antes y el después. */
function changedKeys(entry: AdminAuditEntry): string[] {
  const keys = new Set([...Object.keys(entry.before ?? {}), ...Object.keys(entry.after ?? {})]);
  return [...keys].filter(
    (key) => JSON.stringify(entry.before?.[key]) !== JSON.stringify(entry.after?.[key]),
  );
}

const show = (value: unknown) => (value === undefined ? '—' : JSON.stringify(value));

/** Registro de auditoría: quién, qué, cuándo, antes y después. Solo lectura. */
export default function AuditPage() {
  const [entity, setEntity] = useState('');
  const [more, setMore] = useState<AdminAuditEntry[]>([]);
  const [moreError, setMoreError] = useState<string | null>(null);
  const load = useCallback(
    () => api('adminAuditLog', { query: { limit: 50, ...(entity ? { entity } : {}) } }),
    [entity],
  );
  const { data, error } = useApi(load);
  const entries = [...(data?.entries ?? []), ...more];

  async function loadMore() {
    const last = entries.at(-1);
    if (!last) return;
    try {
      const next = await api('adminAuditLog', {
        query: { limit: 50, before: last.at, ...(entity ? { entity } : {}) },
      });
      setMore((current) => [...current, ...next.entries]);
    } catch (caught) {
      setMoreError(errorMessage(caught));
    }
  }

  return (
    <>
      <PageHeader
        title="Auditoría"
        text="Cada escritura del admin queda acá con su antes y después."
        actions={
          <select
            aria-label="Filtrar por entidad"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={entity}
            onChange={(event) => {
              setEntity(event.target.value);
              setMore([]);
            }}
          >
            {ENTITIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        }
      />
      {(error ?? moreError) && <Notice tone="error">{error ?? moreError}</Notice>}
      {data && entries.length === 0 && <Notice>Sin cambios registrados.</Notice>}
      <ul className="grid gap-2">
        {entries.map((entry) => (
          <li key={entry.id}>
            <Card>
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-mono font-medium">{entry.action}</span>
                <span className="text-muted-foreground">
                  {entry.entity}/{entry.entityId}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(entry.at).toLocaleString('es')} · {entry.actorEmail ?? 'sistema'}
                </span>
              </p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                {changedKeys(entry).map((key) => (
                  <div key={key} className="contents">
                    <dt className="font-mono text-muted-foreground">{key}</dt>
                    <dd className="font-mono break-all">
                      {show(entry.before?.[key])} → {show(entry.after?.[key])}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          </li>
        ))}
      </ul>
      {data?.entries.length === 50 && (
        <Button variant="outline" className="mt-4" onClick={() => void loadMore()}>
          Ver más
        </Button>
      )}
    </>
  );
}
