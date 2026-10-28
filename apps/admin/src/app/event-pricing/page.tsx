'use client';

import { COUNTRY_CODES, CURRENCIES, KIT_PIECES } from '@storynido/shared';

import { ConfigEditor } from '@/components/config/config-editor';
import { money, yesNo } from '@/lib/format';

export default function EventPricingPage() {
  return (
    <ConfigEditor
      kind="eventPricing"
      title="Eventos"
      text="Precio del diseño del kit (incluye el librito) y la licencia de cada pieza extra, por país."
      idFrom={(data) => String(data.country)}
      blank={() => ({ country: 'MX', currency: 'MXN', active: false, designMinor: 0, pieces: {} })}
      fields={[
        {
          kind: 'select',
          path: 'country',
          label: 'País',
          options: COUNTRY_CODES,
          readOnlyOnEdit: true,
        },
        { kind: 'select', path: 'currency', label: 'Moneda', options: CURRENCIES },
        { kind: 'boolean', path: 'active', label: 'Se vende' },
        {
          kind: 'money',
          path: 'designMinor',
          label: 'Diseño (incluye el librito)',
          currencyPath: 'currency',
        },
        {
          kind: 'moneyRecord',
          path: 'pieces',
          label: 'Licencia por pieza (vacía: no se ofrece)',
          keys: KIT_PIECES.filter((piece) => piece !== 'mini_book'),
          currencyPath: 'currency',
        },
      ]}
      columns={[
        { label: 'País', render: (data) => String(data.country) },
        { label: 'Diseño', render: (data) => money(data.designMinor, data.currency) },
        {
          label: 'Piezas',
          render: (data) => Object.keys(data.pieces ?? {}).join(', ') || '—',
        },
        { label: 'Se vende', render: (data) => yesNo(data.active) },
      ]}
    />
  );
}
