'use client';

import type { PriceTableRow } from '@storynido/shared';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Notice, PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { useApi } from '@/lib/use-api';

const BLOCKS: Record<NonNullable<PriceTableRow['blocked']>, string> = {
  country_off: 'País apagado',
  format_off: 'Formato apagado',
  not_for_length: 'No se ofrece en esta extensión',
  no_printer: 'Ninguna imprenta puede',
  price_missing: 'Sin precio',
};

const usd = (minor: number) => money(minor, 'USD');

/**
 * «Precio final»: de dónde sale cada precio (IA + margen de creación + imprenta + margen de
 * impresión), calculado en la API con la misma función que el checkout. Sin envío ni cupones.
 */
export function PriceTable() {
  const load = useCallback(() => api('adminPriceTable'), []);
  const { data, error, reload } = useApi(load);
  const [country, setCountry] = useState<string>('US');
  const [hideBlocked, setHideBlocked] = useState(true);

  const countries = useMemo(
    () => [...new Set((data?.rows ?? []).map((row) => row.country))].sort(),
    [data],
  );
  const rows = (data?.rows ?? []).filter(
    (row) => row.country === country && (!hideBlocked || row.blocked === null),
  );

  return (
    <>
      <PageHeader
        level={2}
        title="Precio final"
        text="Lo que paga el cliente por el libro, sin envío ni cupones, calculado con la misma función que el checkout: costo de IA (páginas × costo por página) + margen de creación; en impresos, la imprenta activa más barata que puede + margen de impresión; redondeado a ,99. Los cambios de Precios e Imprentas tardan hasta un minuto en verse."
        actions={
          <Button variant="outline" onClick={() => void reload()}>
            Recalcular
          </Button>
        }
      />
      {error && <Notice tone="error">{error}</Notice>}
      {data && (
        <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            País
            <select
              className="h-9 rounded-md border bg-background px-2"
              value={country}
              onChange={(event) => {
                setCountry(event.target.value);
              }}
            >
              {countries.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hideBlocked}
              onChange={(event) => {
                setHideBlocked(event.target.checked);
              }}
            />
            Solo lo que se vende
          </label>
          <span className="text-muted-foreground">
            Imprentas activas en este ambiente: {data.activePrinters.join(', ') || 'ninguna'}
          </span>
        </div>
      )}
      {data && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm tabular-nums">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Extensión</th>
                <th className="px-3 py-2 font-medium">Formato</th>
                <th className="px-3 py-2 font-medium">Páginas</th>
                <th className="px-3 py-2 font-medium">IA</th>
                <th className="px-3 py-2 font-medium">Margen creación</th>
                <th className="px-3 py-2 font-medium">Imprenta</th>
                <th className="px-3 py-2 font-medium">Costo imprenta</th>
                <th className="px-3 py-2 font-medium">Margen impresión</th>
                <th className="px-3 py-2 font-medium">Precio</th>
                <th className="px-3 py-2 font-medium">Profesionales</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-4 text-muted-foreground">
                    Nada se vende en este país.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr
                  key={`${row.length}-${row.format}`}
                  className={`border-b last:border-0 ${row.blocked ? 'text-muted-foreground' : ''}`}
                >
                  <td className="px-3 py-2">{row.length}</td>
                  <td className="px-3 py-2">{row.format}</td>
                  <td className="px-3 py-2">
                    {row.pages}
                    {row.printPages !== row.pages && ` (${String(row.printPages)} imprenta)`}
                  </td>
                  <td className="px-3 py-2">{usd(row.aiCostUsdMinor)}</td>
                  <td className="px-3 py-2">{usd(row.creationMarginUsdMinor)}</td>
                  <td className="px-3 py-2">{row.provider ?? '—'}</td>
                  <td className="px-3 py-2">
                    {row.format === 'digital' ? '—' : usd(row.productionCostUsdMinor)}
                  </td>
                  <td className="px-3 py-2">
                    {row.format === 'digital' ? '—' : usd(row.printMarginUsdMinor)}
                  </td>
                  <td className="px-3 py-2 font-semibold">
                    {row.priceMinor === null
                      ? BLOCKS[row.blocked ?? 'price_missing']
                      : usd(row.priceMinor)}
                  </td>
                  <td className="px-3 py-2">
                    {row.proPriceMinor === null ? '—' : usd(row.proPriceMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
