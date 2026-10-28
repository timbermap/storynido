'use client';

import { LESSON_GROUPS } from '@storynido/shared';

import { ConfigEditor } from '@/components/config/config-editor';
import { yesNo } from '@/lib/format';

export default function LessonsPage() {
  return (
    <ConfigEditor
      kind="lessons"
      title="Enseñanzas"
      text="Mensajes que la IA teje en cualquier aventura, con su guía para no sermonear. Los temas sensibles quedan fuera del lanzamiento."
      idFrom={(data) => String(data.slug)}
      blank={() => ({
        slug: '',
        active: false,
        order: 100,
        group: 'values',
        ageMin: 2,
        ageMax: 8,
        name: { es: '', en: '', pt: '' },
        headline: { es: '', en: '', pt: '' },
        description: { es: '', en: '', pt: '' },
        promptGuidance: '',
        sensitive: false,
      })}
      fields={[
        { kind: 'text', path: 'slug', label: 'Slug', readOnlyOnEdit: true },
        { kind: 'boolean', path: 'active', label: 'Activa' },
        { kind: 'select', path: 'group', label: 'Grupo', options: LESSON_GROUPS },
        { kind: 'number', path: 'order', label: 'Orden' },
        { kind: 'number', path: 'ageMin', label: 'Edad mínima', min: 0, max: 12 },
        { kind: 'number', path: 'ageMax', label: 'Edad máxima', min: 0, max: 12 },
        { kind: 'boolean', path: 'sensitive', label: 'Tema sensible (requiere revisión humana)' },
        { kind: 'localized', path: 'name', label: 'Nombre' },
        { kind: 'localized', path: 'headline', label: 'Titular' },
        { kind: 'localized', path: 'description', label: 'Descripción', multiline: true },
        { kind: 'textarea', path: 'promptGuidance', label: 'Guía para la IA', rows: 4 },
      ]}
      columns={[
        {
          label: 'Enseñanza',
          render: (data) => (data.name as Record<string, string> | undefined)?.es ?? '—',
        },
        { label: 'Grupo', render: (data) => String(data.group) },
        { label: 'Edades', render: (data) => `${String(data.ageMin)}–${String(data.ageMax)}` },
        { label: 'Sensible', render: (data) => yesNo(data.sensitive) },
        { label: 'Activa', render: (data) => yesNo(data.active) },
      ]}
    />
  );
}
