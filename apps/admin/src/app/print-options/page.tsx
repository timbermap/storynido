'use client';

import {
  ANY_COUNTRY,
  COUNTRY_CODES,
  PRINT_FORMATS,
  PRINT_PRODUCT_SPECS,
  type PrintFormat,
} from '@storynido/shared';

import { ConfigEditor } from '@/components/config/config-editor';
import { money, yesNo } from '@/lib/format';

/** Ficha del producto (tamaño, encuadernación, papel) según la imprenta y el formato. */
const specOf = (data: Record<string, unknown>) =>
  PRINT_PRODUCT_SPECS[String(data.provider)]?.[data.format as PrintFormat];

/**
 * Matriz de imprentas (`printOptions`): lo que cobra cada imprenta por imprimir, por país y
 * formato. El precio de los impresos sale de acá (más el margen de impresión de Precios).
 */
export default function PrintOptionsPage() {
  return (
    <ConfigEditor
      kind="printOptions"
      title="Imprentas"
      text="Costo de producción por ejemplar (sin envío), plazo y si imprime, por país, formato e imprenta. Una imprenta imprime solo si está habilitada, pasó la muestra física y está activa en este ambiente. El checkout usa la más barata para estimar y elige con la dirección. Lo editado acá ya no lo pisa seed:cloud --refresh-print. Tarda hasta un minuto en llegar al sitio."
      idFrom={(data) => `${String(data.country)}_${String(data.format)}_${String(data.provider)}`}
      blank={() => ({
        country: 'US',
        format: 'softcover',
        provider: 'gelato',
        sku: '',
        enabled: false,
        qaSamplePassed: false,
        pages: { min: 24, max: 200, multipleOf: 2 },
        maxQuantity: 100,
        etaDaysMin: 5,
        etaDaysMax: 10,
        productionCostUsdMinor: 0,
      })}
      extra={(data) => {
        const spec = specOf(data);
        return spec ? (
          <p className="text-sm text-muted-foreground">
            <strong>Producto:</strong> {spec.size} · {spec.binding} · {spec.paper} · Páginas que
            acepta: {spec.pages}.
          </p>
        ) : null;
      }}
      fields={[
        {
          kind: 'select',
          path: 'country',
          label: 'País de destino',
          hint: '* = cualquier país (la del país pisa a la global de la misma imprenta).',
          options: [ANY_COUNTRY, ...COUNTRY_CODES],
          readOnlyOnEdit: true,
        },
        {
          kind: 'select',
          path: 'format',
          label: 'Formato',
          options: PRINT_FORMATS,
          readOnlyOnEdit: true,
        },
        { kind: 'text', path: 'provider', label: 'Imprenta', readOnlyOnEdit: true },
        { kind: 'text', path: 'sku', label: 'Producto de la imprenta (SKU)' },
        {
          kind: 'money',
          path: 'productionCostUsdMinor',
          label: 'Costo de producción por ejemplar (USD)',
          hint: 'Sin envío: el envío se cobra al costo con la dirección.',
          currencyPath: 'currency',
        },
        { kind: 'boolean', path: 'enabled', label: 'Habilitada' },
        { kind: 'boolean', path: 'qaSamplePassed', label: 'Muestra física aprobada' },
        { kind: 'number', path: 'etaDaysMin', label: 'Plazo mínimo (días hábiles)', min: 0 },
        { kind: 'number', path: 'etaDaysMax', label: 'Plazo máximo (días hábiles)', min: 0 },
        { kind: 'number', path: 'pages.min', label: 'Páginas: mínimo', min: 1 },
        { kind: 'number', path: 'pages.max', label: 'Páginas: máximo', min: 1 },
        { kind: 'number', path: 'pages.multipleOf', label: 'Páginas: múltiplo de', min: 1 },
        { kind: 'number', path: 'maxQuantity', label: 'Ejemplares por pedido (máximo)', min: 1 },
      ]}
      columns={[
        { label: 'País', render: (data) => String(data.country) },
        { label: 'Formato', render: (data) => String(data.format) },
        { label: 'Imprenta', render: (data) => String(data.provider) },
        {
          label: 'Producto',
          render: (data) => {
            const spec = specOf(data);
            return spec ? (
              <span className="grid text-xs">
                <span>{spec.size}</span>
                <span className="text-muted-foreground">{spec.binding}</span>
              </span>
            ) : (
              '—'
            );
          },
        },
        {
          label: 'Páginas',
          render: (data) => {
            const pages = data.pages as { min?: number; max?: number; multipleOf?: number };
            return `${String(pages.min)}–${String(pages.max)}${pages.multipleOf && pages.multipleOf > 2 ? ` (×${String(pages.multipleOf)})` : ''}`;
          },
        },
        { label: 'Costo', render: (data) => money(data.productionCostUsdMinor, 'USD') },
        {
          label: 'Plazo',
          render: (data) => `${String(data.etaDaysMin)}–${String(data.etaDaysMax)} días`,
        },
        { label: 'Habilitada', render: (data) => yesNo(data.enabled) },
        { label: 'Muestra', render: (data) => yesNo(data.qaSamplePassed) },
        {
          label: 'Editada',
          render: (data) => (typeof data.updatedBy === 'string' ? data.updatedBy : 'seed'),
        },
      ]}
    />
  );
}
