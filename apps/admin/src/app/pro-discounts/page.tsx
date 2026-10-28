'use client';

import { DEFAULT_PRO_DISCOUNTS } from '@storynido/shared';

import { ConfigEditor } from '@/components/config/config-editor';

export default function ProDiscountsPage() {
  return (
    <ConfigEditor
      kind="proDiscounts"
      title="Profesionales"
      text="Descuento por recurrencia: compras elegibles dentro de la ventana. Aplica a compras futuras; los pedidos ya hechos no cambian."
      single={{ id: 'global', defaults: { ...DEFAULT_PRO_DISCOUNTS } }}
      blank={() => ({ ...DEFAULT_PRO_DISCOUNTS })}
      fields={[
        { kind: 'number', path: 'windowDays', label: 'Ventana (días)', min: 1, max: 365 },
        {
          kind: 'number',
          path: 'physicalMaxPercent',
          label: 'Tope en impresos (%)',
          hint: 'Cuida el margen del libro impreso; en digital rige la tabla.',
          min: 0,
          max: 80,
        },
        { kind: 'tiers', path: 'tiers', label: 'Escalones' },
      ]}
      columns={[]}
    />
  );
}
