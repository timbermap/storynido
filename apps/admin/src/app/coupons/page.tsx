'use client';

import { COUNTRY_CODES, CURRENCIES } from '@storynido/shared';

import { ConfigEditor } from '@/components/config/config-editor';
import { day, money, yesNo } from '@/lib/format';

export default function CouponsPage() {
  return (
    <ConfigEditor
      kind="coupons"
      title="Cupones"
      text="Código, descuento, países y vigencia. No se suman: el cliente recibe el mayor entre cupón, promoción y Pro."
      idFrom={(data) => String(data.code)}
      blank={() => ({
        code: '',
        type: 'percent',
        value: 10,
        currency: null,
        countries: [],
        validFrom: new Date().toISOString(),
        validUntil: null,
        maxRedemptions: null,
        active: true,
      })}
      fields={[
        {
          kind: 'text',
          path: 'code',
          label: 'Código',
          hint: 'Mayúsculas, números, - y _ (3 a 32).',
          readOnlyOnEdit: true,
        },
        { kind: 'boolean', path: 'active', label: 'Activo' },
        { kind: 'select', path: 'type', label: 'Tipo', options: ['percent', 'fixed'] },
        {
          kind: 'number',
          path: 'value',
          label: 'Valor',
          hint: 'Porcentaje (1–100) o monto fijo en centavos.',
          min: 1,
        },
        {
          kind: 'select',
          path: 'currency',
          label: 'Moneda (solo monto fijo)',
          options: CURRENCIES,
          nullable: true,
        },
        { kind: 'number', path: 'maxRedemptions', label: 'Usos máximos', min: 1, nullable: true },
        { kind: 'date', path: 'validFrom', label: 'Desde' },
        { kind: 'date', path: 'validUntil', label: 'Hasta', nullable: true },
        {
          kind: 'multi',
          path: 'countries',
          label: 'Países (ninguno = todos)',
          options: COUNTRY_CODES,
        },
      ]}
      columns={[
        { label: 'Código', render: (_, id) => <span className="font-mono">{id}</span> },
        {
          label: 'Descuento',
          render: (data) =>
            data.type === 'percent' ? `${String(data.value)} %` : money(data.value, data.currency),
        },
        {
          label: 'Usos',
          render: (data) =>
            `${String(Number(data.redemptions ?? 0))}${data.maxRedemptions ? ` / ${String(Number(data.maxRedemptions))}` : ''}`,
        },
        { label: 'Vigencia', render: (data) => `${day(data.validFrom)} → ${day(data.validUntil)}` },
        { label: 'Activo', render: (data) => yesNo(data.active) },
      ]}
    />
  );
}
