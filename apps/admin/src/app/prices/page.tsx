'use client';

import { BOOK_FORMATS, MARGIN_MODES } from '@storynido/shared';

import { ConfigEditor } from '@/components/config/config-editor';
import { PriceTable } from '@/components/config/price-table';
import { money, yesNo } from '@/lib/format';

/** Resumen de un margen para la tabla ("% con mínimo: 30 % / USD 8,00"). */
function describe(margin: unknown): string {
  const value = margin as { mode?: string; fixedUsdMinor?: number; percent?: number } | undefined;
  if (!value?.mode) return '—';
  const fixed = money(value.fixedUsdMinor, 'USD');
  const percent = `${String(value.percent ?? 0)} %`;
  if (value.mode === 'fixed') return `Fijo: ${fixed}`;
  if (value.mode === 'percent') return percent;
  return `${percent}, mín. ${fixed}`;
}

/**
 * Precio = costo + dos márgenes (DECISIONS 096 a 098), todo en dólares: creación (IA por páginas
 * + margen) e impresión (imprenta + margen, solo impresos). El envío se cobra al costo.
 */
export default function PricesPage() {
  return (
    <>
      <ConfigEditor
        kind="productPricing"
        title="Precios y márgenes"
        text="Todo en dólares. Precio = creación + impresión + envío. Creación: costo de IA (costo por página × páginas del libro) + margen de creación. Impresión (solo impresos): lo que cobra la imprenta más barata para esa dirección + margen de impresión. El envío se cobra al costo. Cada margen puede ser fijo, un porcentaje del costo, o un porcentaje con mínimo."
        idFrom={(data) => String(data.product)}
        blank={() => ({
          product: 'digital',
          aiCostPerPageUsdMinor: 15,
          creationMargin: { mode: 'fixed', fixedUsdMinor: 1700, percent: 0 },
          printMargin: { mode: 'percent_min', fixedUsdMinor: 800, percent: 30 },
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
            path: 'aiCostPerPageUsdMinor',
            label: 'Costo de IA por página (USD)',
            hint: 'Con regeneraciones y revisión. El real por libro está en Resumen → costo de IA.',
            currencyPath: 'currency',
          },
          {
            kind: 'select',
            path: 'creationMargin.mode',
            label: 'Margen de creación: tipo',
            options: MARGIN_MODES,
          },
          {
            kind: 'money',
            path: 'creationMargin.fixedUsdMinor',
            label: 'Margen de creación: fijo o mínimo (USD)',
            currencyPath: 'currency',
          },
          {
            kind: 'number',
            path: 'creationMargin.percent',
            label: 'Margen de creación: % del costo de IA',
            min: 0,
            max: 1000,
          },
          {
            kind: 'select',
            path: 'printMargin.mode',
            label: 'Margen de impresión: tipo',
            hint: 'Solo impresos.',
            options: MARGIN_MODES,
          },
          {
            kind: 'money',
            path: 'printMargin.fixedUsdMinor',
            label: 'Margen de impresión: fijo o mínimo (USD)',
            currencyPath: 'currency',
          },
          {
            kind: 'number',
            path: 'printMargin.percent',
            label: 'Margen de impresión: % de lo que cobra la imprenta',
            min: 0,
            max: 1000,
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
          { label: 'IA por página', render: (data) => money(data.aiCostPerPageUsdMinor, 'USD') },
          { label: 'Creación', render: (data) => describe(data.creationMargin) },
          {
            label: 'Impresión',
            render: (data) => (data.product === 'digital' ? '—' : describe(data.printMargin)),
          },
          { label: 'Se vende', render: (data) => yesNo(data.active) },
        ]}
      />
      <PriceTable />
      <ConfigEditor
        section
        kind="products"
        title="Páginas de referencia"
        text="Con cuántas páginas se calcula el precio de la tarjeta de cada formato en el checkout (sin libro elegido todavía). El precio que se cobra siempre usa las páginas reales del libro."
        idFrom={(data) => String(data.format)}
        blank={() => ({
          format: 'digital',
          pageCount: 28,
          active: true,
          name: { es: '', en: '', pt: '' },
        })}
        fields={[
          {
            kind: 'select',
            path: 'format',
            label: 'Formato',
            options: BOOK_FORMATS,
            readOnlyOnEdit: true,
          },
          { kind: 'number', path: 'pageCount', label: 'Páginas de referencia', min: 1 },
          { kind: 'boolean', path: 'active', label: 'Activo' },
          { kind: 'localized', path: 'name', label: 'Nombre' },
        ]}
        columns={[
          { label: 'Formato', render: (data) => String(data.format) },
          { label: 'Páginas', render: (data) => String(data.pageCount) },
          { label: 'Activo', render: (data) => yesNo(data.active) },
        ]}
      />
    </>
  );
}
