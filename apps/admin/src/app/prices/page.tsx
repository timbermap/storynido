'use client';

import {
  BOOK_FORMATS,
  BOOK_LENGTHS,
  COUNTRY_CODES,
  CURRENCIES,
  priceDocId,
} from '@storynido/shared';

import { ConfigEditor } from '@/components/config/config-editor';
import { money, yesNo } from '@/lib/format';

export default function PricesPage() {
  return (
    <ConfigEditor
      kind="prices"
      title="Precios"
      text="Precio por país y formato (Familias y Pro base) y el ajuste por extensión. Los descuentos Pro van en Profesionales."
      idFrom={(data) => priceDocId(String(data.country), String(data.format))}
      blank={() => ({
        country: 'MX',
        format: 'digital',
        currency: 'MXN',
        amountMinor: 0,
        lengthAdjustmentsMinor: {},
        active: false,
      })}
      fields={[
        {
          kind: 'select',
          path: 'country',
          label: 'País',
          options: COUNTRY_CODES,
          readOnlyOnEdit: true,
        },
        {
          kind: 'select',
          path: 'format',
          label: 'Formato',
          options: BOOK_FORMATS,
          readOnlyOnEdit: true,
        },
        { kind: 'select', path: 'currency', label: 'Moneda', options: CURRENCIES },
        { kind: 'boolean', path: 'active', label: 'Activo' },
        { kind: 'money', path: 'amountMinor', label: 'Precio Familias', currencyPath: 'currency' },
        {
          kind: 'money',
          path: 'proAmountMinor',
          label: 'Precio Pro base',
          hint: 'Vacío: el de Familias.',
          currencyPath: 'currency',
        },
        {
          kind: 'moneyRecord',
          path: 'lengthAdjustmentsMinor',
          label: 'Ajuste por extensión (se suma; puede ser negativo)',
          keys: BOOK_LENGTHS,
          currencyPath: 'currency',
          signed: true,
        },
      ]}
      columns={[
        { label: 'País', render: (data) => String(data.country) },
        { label: 'Formato', render: (data) => String(data.format) },
        { label: 'Familias', render: (data) => money(data.amountMinor, data.currency) },
        { label: 'Pro base', render: (data) => money(data.proAmountMinor, data.currency) },
        { label: 'Activo', render: (data) => yesNo(data.active) },
      ]}
    />
  );
}
