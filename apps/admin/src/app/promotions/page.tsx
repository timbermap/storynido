'use client';

import { BOOK_FORMATS, COUNTRY_CODES } from '@storynido/shared';

import { ConfigEditor } from '@/components/config/config-editor';
import { day, yesNo } from '@/lib/format';

export default function PromotionsPage() {
  return (
    <ConfigEditor
      kind="promotions"
      title="Promociones"
      text="Descuento automático con fecha de inicio y fin, por país y formato."
      blank={() => ({
        name: '',
        discountPercent: 10,
        countries: [],
        formats: [],
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        active: true,
      })}
      fields={[
        { kind: 'text', path: 'name', label: 'Nombre' },
        { kind: 'boolean', path: 'active', label: 'Activa' },
        { kind: 'number', path: 'discountPercent', label: 'Descuento (%)', min: 1, max: 100 },
        { kind: 'date', path: 'startsAt', label: 'Empieza' },
        { kind: 'date', path: 'endsAt', label: 'Termina' },
        {
          kind: 'multi',
          path: 'countries',
          label: 'Países (ninguno = todos)',
          options: COUNTRY_CODES,
        },
        {
          kind: 'multi',
          path: 'formats',
          label: 'Formatos (ninguno = todos)',
          options: BOOK_FORMATS,
        },
      ]}
      columns={[
        { label: 'Nombre', render: (data) => String(data.name) },
        { label: 'Descuento', render: (data) => `${String(data.discountPercent)} %` },
        { label: 'Vigencia', render: (data) => `${day(data.startsAt)} → ${day(data.endsAt)}` },
        { label: 'Activa', render: (data) => yesNo(data.active) },
      ]}
    />
  );
}
