'use client';

import { CONTENT_KEYS, LOCALES } from '@storynido/shared';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { ConfigEditor } from '@/components/config/config-editor';
import { yesNo } from '@/lib/format';

export default function ContentPage() {
  return (
    <ConfigEditor
      kind="content"
      title="Contenido"
      text="Textos legales, preguntas frecuentes y banner por idioma, en Markdown. La web los toma en unos minutos."
      idFrom={(data) => `${String(data.key)}_${String(data.locale)}`}
      blank={() => ({ key: 'faq', locale: 'es', title: '', body: '', published: false })}
      fields={[
        {
          kind: 'select',
          path: 'key',
          label: 'Texto',
          options: CONTENT_KEYS,
          readOnlyOnEdit: true,
        },
        { kind: 'select', path: 'locale', label: 'Idioma', options: LOCALES, readOnlyOnEdit: true },
        { kind: 'text', path: 'title', label: 'Título' },
        { kind: 'boolean', path: 'published', label: 'Publicado' },
        { kind: 'textarea', path: 'body', label: 'Texto (Markdown)', rows: 16 },
      ]}
      extra={(data) => (
        <section className="rounded-md border border-dashed p-4">
          <p className="mb-2 text-xs text-muted-foreground">Vista previa</p>
          <div className="prose-admin text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {typeof data.body === 'string' ? data.body : ''}
            </ReactMarkdown>
          </div>
        </section>
      )}
      columns={[
        { label: 'Texto', render: (data) => String(data.key) },
        { label: 'Idioma', render: (data) => String(data.locale) },
        { label: 'Título', render: (data) => String(data.title) },
        { label: 'Publicado', render: (data) => yesNo(data.published) },
        {
          label: 'Cambió',
          render: (data) => (typeof data.updatedBy === 'string' ? data.updatedBy : '—'),
        },
      ]}
    />
  );
}
