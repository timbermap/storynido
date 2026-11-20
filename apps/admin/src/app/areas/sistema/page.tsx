'use client';

import { useCallback } from 'react';

import { AreaPage } from '@/components/areas/area-page';
import { Card } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { attentionFor, daysAgo } from '@/lib/area-data';
import { SITE_MODE_INFO } from '@/lib/site-modes';
import { useApi } from '@/lib/use-api';

/** Sistema: modo del sitio y los últimos cambios del panel. */
export default function SystemSummaryPage() {
  const load = useCallback(
    () =>
      Promise.all([
        api('adminSiteConfig'),
        api('adminAuditLog', { query: { limit: 50 } }),
        api('adminAttention'),
      ]),
    [],
  );
  const { data, error } = useApi(load);
  const [site, audit, attention] = data ?? [];
  const entries = audit?.entries ?? [];
  const byActor = new Map<string, number>();
  for (const entry of entries.filter((e) => daysAgo(e.at, 7)))
    byActor.set(
      entry.actorEmail ?? 'Sistema',
      (byActor.get(entry.actorEmail ?? 'Sistema') ?? 0) + 1,
    );
  return (
    <AreaPage
      area="Sistema"
      text="Mantenimiento del sitio, conexiones y quién cambió qué."
      loaded={data !== null}
      error={error}
      attention={attentionFor('Sistema', attention?.items)}
      stats={[
        {
          label: 'Modo del sitio',
          value: site ? SITE_MODE_INFO[site.mode].label : '',
        },
        { label: 'Cambios 7 días', value: String(entries.filter((e) => daysAgo(e.at, 7)).length) },
      ]}
      barsTitle="Cambios por persona (7 días)"
      bars={[...byActor.entries()].map(([label, value]) => ({ label, value }))}
    >
      <Card>
        <h2 className="mb-3 text-sm font-semibold">Últimos cambios</h2>
        <ul className="grid gap-1 text-sm">
          {entries.slice(0, 8).map((entry) => (
            <li key={entry.id} className="flex justify-between gap-3">
              <span className="truncate">
                {entry.actorEmail ?? 'Sistema'} · {entry.action} {entry.entity}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {new Date(entry.at).toLocaleString('es', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </AreaPage>
  );
}
