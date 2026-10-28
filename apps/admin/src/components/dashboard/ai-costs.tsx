'use client';

import { useCallback } from 'react';

import { Card, Notice } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';

const usd = (value: number) => `USD ${value.toFixed(2)}`;

/** Costo real de los últimos 30 días: por muestra, por libro y por modelo (desde aiUsage). */
export function AiCosts() {
  const load = useCallback(() => api('adminAiCosts', { query: { days: 30 } }), []);
  const { data, error } = useApi(load);
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <p role="status">Cargando costos…</p>;
  const groups = [
    ['Por muestra', data.perPreview],
    ['Por libro final', data.perBook],
  ] as const;
  return (
    <Card className="mt-6 grid gap-4">
      <h2 className="font-semibold">Costo real (últimos 30 días)</h2>
      {groups.map(([title, rows]) => (
        <div key={title}>
          <h3 className="mb-1 text-sm font-medium">{title}</h3>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
          ) : (
            <table className="w-full text-sm tabular-nums">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th>Modelo de imagen</th>
                  <th>Cantidad</th>
                  <th>Promedio</th>
                  <th>p50</th>
                  <th>p95</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.imageModel} className="border-t">
                    <td className="py-1 font-mono text-xs">{row.imageModel}</td>
                    <td>{row.count}</td>
                    <td>{usd(row.avgUsd)}</td>
                    <td>{usd(row.p50Usd)}</td>
                    <td>{usd(row.p95Usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
      <div>
        <h3 className="mb-1 text-sm font-medium">Por modelo</h3>
        <table className="w-full text-sm tabular-nums">
          <tbody>
            {data.byModel.map((row) => (
              <tr key={`${row.provider}/${row.model}`} className="border-t first:border-0">
                <td className="py-1 font-mono text-xs">
                  {row.provider}/{row.model}
                </td>
                <td>{row.calls} llamadas</td>
                <td className="text-right">{usd(row.totalUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Costo estimado de cada llamada con el precio del catálogo vigente en ese momento (o el de
        lista, o el peor caso si no tiene precio).
      </p>
    </Card>
  );
}
