'use client';

import { BOOK_FORMATS, BOOK_LENGTHS, MARGIN_MODES } from '@storynido/shared';

import { ConfigEditor } from '@/components/config/config-editor';
import { money, yesNo } from '@/lib/format';

const MODE_LABEL: Record<string, string> = {
  fixed: 'Monto fijo',
  percent: 'Porcentaje del costo',
  percent_min: 'Porcentaje, con mínimo',
};

/**
 * Precio = costo + margen (DECISIONS 096). Un producto por fila; todo en dólares (sin campo de
 * moneda: los montos se editan en USD) y la web lo convierte a la moneda de cada país.
 */
export default function PricesPage() {
  return (
    <ConfigEditor
      kind="productPricing"
      title="Precios y márgenes"
      text="El precio sale del costo real más tu margen, en dólares, y se convierte a la moneda de cada país. En el impreso, el costo es el de la imprenta más barata para esa dirección y el envío se cobra al costo. El margen puede ser un monto fijo, un porcentaje del costo, o un porcentaje con un mínimo."
      idFrom={(data) => String(data.product)}
      blank={() => ({
        product: 'digital',
        baseCostUsdMinor: 100,
        marginMode: 'fixed',
        marginFixedUsdMinor: 0,
        marginPercent: 0,
        lengthAdjustmentsUsdMinor: {},
        proPercentOff: 10,
        active: false,
      })}
      fields={[
        {
          kind: 'select',
          path: 'product',
          label: 'Producto',
          options: BOOK_FORMATS,
          readOnlyOnEdit: true,
        },
        { kind: 'boolean', path: 'active', label: 'Se vende' },
        {
          kind: 'money',
          path: 'baseCostUsdMinor',
          label: 'Costo propio (USD)',
          hint: 'Aparte de la imprenta: IA, PDF y operación por libro.',
          currencyPath: 'currency',
        },
        { kind: 'select', path: 'marginMode', label: 'Tipo de margen', options: MARGIN_MODES },
        {
          kind: 'money',
          path: 'marginFixedUsdMinor',
          label: 'Margen fijo o mínimo (USD)',
          hint: 'Monto fijo: es el margen. Porcentaje con mínimo: nunca menos que esto.',
          currencyPath: 'currency',
        },
        {
          kind: 'number',
          path: 'marginPercent',
          label: 'Margen en % del costo',
          hint: 'Para "porcentaje" y "porcentaje, con mínimo". El envío no lleva margen.',
          min: 0,
          max: 1000,
        },
        {
          kind: 'moneyRecord',
          path: 'lengthAdjustmentsUsdMinor',
          label: 'Ajuste por extensión (USD; se suma, puede ser negativo)',
          keys: BOOK_LENGTHS,
          currencyPath: 'currency',
          signed: true,
        },
        {
          kind: 'number',
          path: 'proPercentOff',
          label: 'Descuento base Profesionales (%)',
          hint: 'Aparte del descuento por compras (en Profesionales).',
          min: 0,
          max: 80,
        },
      ]}
      columns={[
        { label: 'Producto', render: (data) => String(data.product) },
        { label: 'Margen', render: (data) => MODE_LABEL[String(data.marginMode)] ?? '—' },
        {
          label: 'Fijo / mínimo',
          render: (data) => money(data.marginFixedUsdMinor, 'USD'),
        },
        { label: '%', render: (data) => `${String(data.marginPercent)} %` },
        { label: 'Se vende', render: (data) => yesNo(data.active) },
      ]}
    />
  );
}
