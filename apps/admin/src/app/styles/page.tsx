'use client';

import { CONTENT_TYPES } from '@storynido/shared';

import { ConfigEditor } from '@/components/config/config-editor';
import { yesNo } from '@/lib/format';

export default function StylesPage() {
  return (
    <ConfigEditor
      kind="styles"
      title="Estilos de ilustración"
      text="Nombre, indicación para la IA de imagen y los tipos de contenido donde se ofrece."
      idFrom={(data) => String(data.slug)}
      blank={() => ({
        slug: '',
        active: false,
        order: 100,
        name: { es: '', en: '', pt: '' },
        promptModifier: '',
        sampleImage: null,
        contentTypes: ['story', 'activities', 'story_activities'],
      })}
      fields={[
        { kind: 'text', path: 'slug', label: 'Slug', readOnlyOnEdit: true },
        { kind: 'boolean', path: 'active', label: 'Activo' },
        { kind: 'number', path: 'order', label: 'Orden' },
        { kind: 'text', path: 'sampleImage', label: 'Imagen de muestra (ruta)' },
        { kind: 'localized', path: 'name', label: 'Nombre' },
        {
          kind: 'textarea',
          path: 'promptModifier',
          label: 'Indicación de estilo (inglés)',
          rows: 3,
        },
        {
          kind: 'multi',
          path: 'contentTypes',
          label: 'Tipos de contenido',
          options: CONTENT_TYPES,
        },
      ]}
      columns={[
        {
          label: 'Estilo',
          render: (data) => (data.name as Record<string, string> | undefined)?.es ?? '—',
        },
        { label: 'Slug', render: (_, id) => <span className="font-mono text-xs">{id}</span> },
        { label: 'Activo', render: (data) => yesNo(data.active) },
      ]}
    />
  );
}
