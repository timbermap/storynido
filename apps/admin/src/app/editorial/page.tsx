'use client';

import { DEFAULT_EDITORIAL_CONFIG } from '@storynido/shared';

import { ConfigEditor } from '@/components/config/config-editor';

export default function EditorialPage() {
  return (
    <ConfigEditor
      kind="editorial"
      title="Opciones editoriales"
      text="Extensiones (páginas interiores y fijas, formatos), densidades (palabras por página), niveles de lectura (guía para la IA), tipos de contenido y valores por defecto. La API valida todo antes de guardar."
      single={{ id: 'global', defaults: { ...DEFAULT_EDITORIAL_CONFIG } }}
      blank={() => ({ ...DEFAULT_EDITORIAL_CONFIG })}
      fields={[
        { kind: 'json', path: 'lengths', label: 'Extensiones', rows: 14 },
        { kind: 'json', path: 'densities', label: 'Densidades', rows: 8 },
        { kind: 'json', path: 'levels', label: 'Niveles de lectura', rows: 8 },
        { kind: 'json', path: 'contentTypes', label: 'Tipos de contenido', rows: 6 },
        { kind: 'json', path: 'defaults', label: 'Valores por defecto', rows: 6 },
      ]}
      columns={[]}
    />
  );
}
