'use client';

import { CHANNELS } from '@storynido/shared';

import { ConfigEditor } from '@/components/config/config-editor';
import { yesNo } from '@/lib/format';

export default function CollectionsPage() {
  return (
    <ConfigEditor
      kind="collections"
      title="Colecciones"
      text="Colecciones editoriales por línea, con sus temas u objetivos (en Profesionales se eligen al crear). Las historias se asignan desde Historias."
      idFrom={(data) => String(data.slug)}
      blank={() => ({
        slug: '',
        active: false,
        order: 100,
        channel: 'families',
        name: { es: '', en: '', pt: '' },
        description: { es: '', en: '', pt: '' },
        topics: [],
      })}
      fields={[
        { kind: 'text', path: 'slug', label: 'Slug', readOnlyOnEdit: true },
        { kind: 'boolean', path: 'active', label: 'Activa' },
        { kind: 'select', path: 'channel', label: 'Línea', options: CHANNELS },
        { kind: 'number', path: 'order', label: 'Orden' },
        { kind: 'localized', path: 'name', label: 'Nombre' },
        { kind: 'localized', path: 'description', label: 'Descripción', multiline: true },
        {
          kind: 'json',
          path: 'topics',
          label: 'Temas (hasta 12)',
          hint: 'Lista de { "es": "…", "en": "…", "pt": "…" }',
          rows: 8,
        },
      ]}
      columns={[
        {
          label: 'Colección',
          render: (data) => (data.name as Record<string, string> | undefined)?.es ?? '—',
        },
        { label: 'Línea', render: (data) => String(data.channel) },
        {
          label: 'Temas',
          render: (data) => String(Array.isArray(data.topics) ? data.topics.length : 0),
        },
        { label: 'Orden', render: (data) => String(data.order) },
        { label: 'Activa', render: (data) => yesNo(data.active) },
      ]}
    />
  );
}
