'use client';

import { COUNTRY_CODES, CURRENCIES, LOCALES } from '@storynido/shared';

import { ConfigEditor } from '@/components/config/config-editor';
import { yesNo } from '@/lib/format';

export default function CountriesPage() {
  return (
    <ConfigEditor
      kind="countries"
      title="Países"
      text="Todos los países se venden: los que no están en esta lista cobran en dólares, sin impuesto propio. Acá se pisa un país (moneda local, impuesto, apagar un formato o el país entero). Los precios salen de Precios y márgenes; el envío se cotiza con cada pedido."
      idFrom={(data) => String(data.code)}
      blank={() => ({
        code: 'MX',
        active: false,
        formats: { digital: true, softcover: false, hardcover: false, booklet: false },
        currency: 'USD',
        defaultLocale: 'es',
        taxBasisPoints: 0,
        taxIncludedInPrice: true,
        shipping: { costMinor: 0, etaDaysMin: 5, etaDaysMax: 10 },
      })}
      fields={[
        {
          kind: 'select',
          path: 'code',
          label: 'País',
          options: COUNTRY_CODES,
          readOnlyOnEdit: true,
        },
        { kind: 'boolean', path: 'active', label: 'Activo' },
        {
          kind: 'select',
          path: 'currency',
          label: 'Moneda local (solo referencia: todo se cobra en USD)',
          options: CURRENCIES,
        },
        { kind: 'select', path: 'defaultLocale', label: 'Idioma por defecto', options: LOCALES },
        { kind: 'boolean', path: 'formats.digital', label: 'Digital' },
        { kind: 'boolean', path: 'formats.softcover', label: 'Tapa blanda' },
        { kind: 'boolean', path: 'formats.hardcover', label: 'Tapa dura' },
        { kind: 'boolean', path: 'formats.booklet', label: 'Cuento grapado' },
        {
          kind: 'number',
          path: 'taxBasisPoints',
          label: 'Impuesto (puntos básicos)',
          hint: '1600 = 16 %',
          min: 0,
          max: 10000,
        },
        { kind: 'boolean', path: 'taxIncludedInPrice', label: 'Impuesto incluido en el precio' },
      ]}
      columns={[
        { label: 'País', render: (data) => String(data.code) },
        { label: 'Activo', render: (data) => yesNo(data.active) },
        {
          label: 'Formatos',
          render: (data) =>
            Object.entries((data.formats ?? {}) as Record<string, boolean>)
              .filter(([, on]) => on)
              .map(([format]) => format)
              .join(', ') || '—',
        },
        { label: 'Impuesto', render: (data) => `${String(Number(data.taxBasisPoints) / 100)} %` },
        { label: 'Moneda', render: (data) => String(data.currency) },
      ]}
    />
  );
}
