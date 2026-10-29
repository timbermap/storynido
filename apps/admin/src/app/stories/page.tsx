'use client';

import {
  BOOK_LENGTHS,
  CHANNELS,
  CONTENT_TYPES,
  PALETTE_KEYS,
  READING_LEVELS,
  TEXT_DENSITIES,
} from '@storynido/shared';

import { PromptTest } from '@/components/catalog/prompt-test';
import { ConfigEditor } from '@/components/config/config-editor';
import { yesNo } from '@/lib/format';

const localized = (value: unknown) => (value as Record<string, string> | undefined)?.es ?? '—';

export default function StoriesPage() {
  return (
    <ConfigEditor
      kind="stories"
      title="Historias"
      text="Temáticas y plantillas: edades, prompts de texto e imagen, páginas de muestra, líneas, colecciones y opciones editoriales."
      idFrom={(data) => String(data.slug)}
      blank={() => ({
        slug: '',
        active: false,
        order: 100,
        ageMin: 3,
        ageMax: 8,
        tags: [],
        palette: null,
        pageCount: 12,
        title: { es: '', en: '', pt: '' },
        summary: { es: '', en: '', pt: '' },
        excerpt: { es: '', en: '', pt: '' },
        coverImage: '',
        samplePages: [],
        textPromptTemplate: '',
        imagePromptTemplate: '{{scene}} {{character}}. Style: {{style}}',
        lengths: [...BOOK_LENGTHS],
        textDensities: [...TEXT_DENSITIES],
        readingLevels: [...READING_LEVELS],
        contentTypes: ['story', 'story_activities'],
        channels: ['families'],
        collectionIds: [],
        personalization: { photo: true, avatar: true, memories: true, lessons: true },
      })}
      fields={[
        {
          kind: 'text',
          path: 'slug',
          label: 'Slug',
          hint: 'minúsculas y guiones',
          readOnlyOnEdit: true,
        },
        { kind: 'boolean', path: 'active', label: 'Activa' },
        { kind: 'number', path: 'order', label: 'Orden' },
        { kind: 'number', path: 'pageCount', label: 'Páginas (historias anteriores)', min: 1 },
        { kind: 'number', path: 'ageMin', label: 'Edad mínima', min: 0, max: 12 },
        { kind: 'number', path: 'ageMax', label: 'Edad máxima', min: 0, max: 12 },
        { kind: 'localized', path: 'title', label: 'Título' },
        { kind: 'localized', path: 'summary', label: 'Resumen', multiline: true },
        { kind: 'localized', path: 'excerpt', label: 'Fragmento de muestra', multiline: true },
        { kind: 'text', path: 'coverImage', label: 'Portada de muestra (ruta)' },
        { kind: 'tags', path: 'samplePages', label: 'Páginas de muestra (rutas)' },
        { kind: 'tags', path: 'tags', label: 'Etiquetas' },
        {
          kind: 'textarea',
          path: 'textPromptTemplate',
          label: 'Prompt de texto',
          hint: 'Variables: {{childName}}, {{age}}, {{pageCount}}, {{lessons}}, {{likes}}…',
          rows: 8,
        },
        {
          kind: 'textarea',
          path: 'imagePromptTemplate',
          label: 'Prompt de imagen',
          hint: 'Variables: {{scene}}, {{character}}, {{style}}. La dirección de arte (paleta, edad, qué evitar) se suma siempre al final.',
          rows: 3,
        },
        {
          kind: 'select',
          path: 'palette',
          label: 'Paleta de los libros',
          options: PALETTE_KEYS,
          nullable: true,
        },
        { kind: 'multi', path: 'channels', label: 'Líneas', options: CHANNELS },
        { kind: 'tags', path: 'collectionIds', label: 'Colecciones (slugs)' },
        { kind: 'tags', path: 'suggestedLessons', label: 'Enseñanzas sugeridas (slugs)' },
        { kind: 'multi', path: 'lengths', label: 'Extensiones', options: BOOK_LENGTHS },
        { kind: 'multi', path: 'textDensities', label: 'Densidades', options: TEXT_DENSITIES },
        { kind: 'multi', path: 'readingLevels', label: 'Niveles', options: READING_LEVELS },
        {
          kind: 'multi',
          path: 'contentTypes',
          label: 'Tipos de contenido',
          options: CONTENT_TYPES,
        },
        { kind: 'json', path: 'personalization', label: 'Personalización admitida', rows: 6 },
        {
          kind: 'json',
          path: 'objectives',
          label: 'Objetivos propios (Profesionales)',
          hint: 'Lista de { "es", "en", "pt" }. Si tiene, reemplazan a los temas de la colección y a las enseñanzas en la ficha.',
          rows: 6,
        },
      ]}
      extra={(data) => <PromptTest data={data} />}
      columns={[
        { label: 'Historia', render: (data) => localized(data.title) },
        { label: 'Slug', render: (_, id) => <span className="font-mono text-xs">{id}</span> },
        { label: 'Edades', render: (data) => `${String(data.ageMin)}–${String(data.ageMax)}` },
        {
          label: 'Líneas',
          render: (data) => (Array.isArray(data.channels) ? data.channels.join(', ') : '—'),
        },
        { label: 'Activa', render: (data) => yesNo(data.active) },
      ]}
    />
  );
}
