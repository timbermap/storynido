'use client';

import { COUNTRY_CODES, COUNTRY_DEFAULTS, CURRENCIES, LOCALES } from '@storynido/shared';

import { ConfigEditor } from '@/components/config/config-editor';
import { money, yesNo } from '@/lib/format';

export default function CountriesPage() {
  return (
    <ConfigEditor
      kind="countries"
      title="Países"
      text="Activación, formatos, moneda, impuestos, envío e idioma por defecto. Los precios van en Precios."
      idFrom={(data) => String(data.code)}
      blank={() => ({
        code: 'MX',
        active: false,
        formats: { digital: true, softcover: false, hardcover: false },
        currency: COUNTRY_DEFAULTS.MX.currency,
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
        { kind: 'select', path: 'currency', label: 'Moneda', options: CURRENCIES },
        { kind: 'select', path: 'defaultLocale', label: 'Idioma por defecto', options: LOCALES },
        { kind: 'boolean', path: 'formats.digital', label: 'Digital' },
        { kind: 'boolean', path: 'formats.softcover', label: 'Tapa blanda' },
        { kind: 'boolean', path: 'formats.hardcover', label: 'Tapa dura' },
        {
          kind: 'number',
          path: 'taxBasisPoints',
          label: 'Impuesto (puntos básicos)',
          hint: '1600 = 16 %',
          min: 0,
          max: 10000,
        },
        { kind: 'boolean', path: 'taxIncludedInPrice', label: 'Impuesto incluido en el precio' },
        {
          kind: 'money',
          path: 'shipping.costMinor',
          label: 'Envío al cliente',
          currencyPath: 'currency',
        },
        { kind: 'number', path: 'shipping.etaDaysMin', label: 'Envío: días mínimos', min: 0 },
        { kind: 'number', path: 'shipping.etaDaysMax', label: 'Envío: días máximos', min: 0 },
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
        {
          label: 'Envío',
          render: (data) =>
            money((data.shipping as { costMinor?: number } | undefined)?.costMinor, data.currency),
        },
      ]}
    />
  );
}
