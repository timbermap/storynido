'use client';

import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, Notice, PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { errorMessage, useApi } from '@/lib/use-api';

type Kind = 'print' | 'email' | 'ai' | 'storage' | 'payment';

const LABELS: Record<Kind, string> = {
  print: 'Imprenta',
  email: 'Mails',
  ai: 'IA',
  storage: 'Archivos',
  payment: 'Pagos',
};

/** Estado de los proveedores activos y prueba de conexión (sin pedidos ni mails reales). */
export default function IntegrationsPage() {
  const load = useCallback(() => api('adminProviders'), []);
  const { data, error } = useApi(load);
  const [results, setResults] = useState<
    Record<string, { ok: boolean; detail: string; ms: number }>
  >({});

  async function test(kind: Kind, id?: string) {
    const key = id ? `${kind}:${id}` : kind;
    setResults((current) => ({ ...current, [key]: { ok: true, detail: 'Probando…', ms: 0 } }));
    try {
      const result = await api('adminTestIntegration', { body: id ? { kind, id } : { kind } });
      setResults((current) => ({ ...current, [key]: result }));
    } catch (caught) {
      setResults((current) => ({
        ...current,
        [key]: { ok: false, detail: errorMessage(caught), ms: 0 },
      }));
    }
  }

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <p role="status">Cargando…</p>;
  const active = data.active as Record<string, string | string[]>;
  const rows: { kind: Kind; id?: string; label: string }[] = [
    ...(Array.isArray(active.print) ? active.print : [active.print ?? '']).map((id) => ({
      kind: 'print' as const,
      id,
      label: `${LABELS.print}: ${id}`,
    })),
    { kind: 'email', label: `${LABELS.email}: ${String(active.email)}` },
    { kind: 'ai', label: `${LABELS.ai}: ${String(active.aiText)} / ${String(active.aiImage)}` },
    { kind: 'storage', label: `${LABELS.storage}: ${String(active.storage)}` },
    { kind: 'payment', label: `${LABELS.payment}: ${String(active.payment)}` },
  ];
  return (
    <>
      <PageHeader
        title="Integraciones"
        text="La imprenta cotiza a EE. UU. sin crear pedidos; los mails verifican la clave sin enviar; la IA hace una moderación mínima (costo ínfimo)."
      />
      <div className="grid gap-3">
        {rows.map((row) => {
          const key = row.id ? `${row.kind}:${row.id}` : row.kind;
          const result = results[key];
          return (
            <Card key={key} className="flex flex-wrap items-center gap-3">
              <p className="min-w-48 flex-1 font-medium">{row.label}</p>
              {result && (
                <p role="status" className={`text-sm ${result.ok ? '' : 'text-destructive'}`}>
                  {result.ok ? '✓' : '✕'} {result.detail}
                  {result.ms ? ` (${String(result.ms)} ms)` : ''}
                </p>
              )}
              <Button variant="outline" size="sm" onClick={() => void test(row.kind, row.id)}>
                Probar conexión
              </Button>
            </Card>
          );
        })}
      </div>
    </>
  );
}
