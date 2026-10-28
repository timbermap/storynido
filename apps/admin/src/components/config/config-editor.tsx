'use client';

import type { AdminConfigKind } from '@storynido/shared';
import { Pencil, Plus } from 'lucide-react';
import { useCallback, useState, type ReactNode, type SubmitEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Card, Notice, PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { setPath } from '@/lib/paths';
import { errorMessage, useApi } from '@/lib/use-api';

import { FieldInput, type FieldSpec } from './fields';

type Data = Record<string, unknown>;

/** Campos que ocupan todo el ancho del formulario. */
const WIDE_FIELDS = new Set<FieldSpec['kind']>([
  'moneyRecord',
  'tiers',
  'multi',
  'textarea',
  'localized',
  'json',
]);

export interface ConfigEditorProps {
  kind: AdminConfigKind;
  title: string;
  text: string;
  fields: readonly FieldSpec[];
  columns: readonly { label: string; render: (data: Data, id: string) => ReactNode }[];
  /** Valores de un documento nuevo. */
  blank: () => Data;
  /** Id del documento a partir de sus datos (clave natural); sin él, el admin escribe un slug. */
  idFrom?: (data: Data) => string;
  /** Un solo documento (por ejemplo `proDiscounts/global`): se edita directo. */
  single?: { id: string; defaults: Data };
  /** Algo más debajo del formulario (por ejemplo, probar el prompt con datos de ejemplo). */
  extra?: (data: Data) => ReactNode;
}

/** Tabla + formulario para un tipo de configuración. La API valida y audita cada cambio. */
export function ConfigEditor({
  kind,
  title,
  text,
  fields,
  columns,
  blank,
  idFrom,
  single,
  extra,
}: ConfigEditorProps) {
  const load = useCallback(() => api('adminConfigList', { params: { kind } }), [kind]);
  const { data, error, reload } = useApi(load);
  const [editing, setEditing] = useState<{ id: string | null; data: Data } | null>(null);
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const singleItem = single && data ? data.items.find((item) => item.id === single.id) : null;
  const form = single
    ? (editing ?? (data ? { id: single.id, data: singleItem?.data ?? single.defaults } : null))
    : editing;

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    const id = form.id ?? (idFrom ? idFrom(form.data) : slug.trim());
    // "Nuevo" nunca pisa uno existente: se edita desde la tabla.
    if (form.id === null && data?.items.some((item) => item.id === id)) {
      setMessage({ text: `"${id}" ya existe: edítalo desde la tabla.`, error: true });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await api('adminConfigSave', { params: { kind, id }, body: form.data });
      setMessage({ text: `Guardado "${id}". Queda en la auditoría.`, error: false });
      setEditing(null);
      setSlug('');
      await reload();
    } catch (caught) {
      setMessage({ text: errorMessage(caught), error: true });
    } finally {
      setSaving(false);
    }
  }

  const formView = form && (
    <Card className="mb-6">
      <form onSubmit={(event) => void save(event)} className="grid gap-4">
        <h2 className="font-semibold">
          {form.id ? `Editar ${form.id}` : 'Nuevo'}
          {!single && !form.id && !idFrom && (
            <label className="mt-2 grid gap-1 text-sm font-normal">
              Id (letras, números y guiones)
              <input
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={slug}
                required
                pattern="[A-Za-z0-9._-]{1,80}"
                onChange={(event) => {
                  setSlug(event.target.value);
                }}
              />
            </label>
          )}
        </h2>
        {/* Cada documento con su propio estado de campos (p. ej. el texto de un JSON). */}
        <div key={form.id ?? 'nuevo'} className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <label
              key={field.path}
              className={`grid content-start gap-1 text-sm ${
                WIDE_FIELDS.has(field.kind) ? 'sm:col-span-2' : ''
              }`}
            >
              <span className="font-medium">{field.label}</span>
              <FieldInput
                field={field}
                data={form.data}
                editing={form.id !== null}
                onChange={(value) => {
                  setEditing({ id: form.id, data: setPath(form.data, field.path, value) });
                }}
              />
              {field.hint && <span className="text-xs text-muted-foreground">{field.hint}</span>}
            </label>
          ))}
        </div>
        {extra?.(form.data)}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            Guardar
          </Button>
          {!single && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(null);
              }}
            >
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </Card>
  );

  return (
    <>
      <PageHeader
        title={title}
        text={text}
        actions={
          !single && (
            <Button
              onClick={() => {
                setEditing({ id: null, data: blank() });
                setMessage(null);
              }}
            >
              <Plus aria-hidden="true" /> Nuevo
            </Button>
          )
        }
      />
      {error && <Notice tone="error">{error}</Notice>}
      {message && (
        <div className="mb-4">
          <Notice tone={message.error ? 'error' : 'info'}>{message.text}</Notice>
        </div>
      )}
      {formView}
      {!single && data && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                {columns.map((column) => (
                  <th key={column.label} className="px-3 py-2 font-medium">
                    {column.label}
                  </th>
                ))}
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-3 py-4 text-muted-foreground">
                    Todavía no hay nada cargado.
                  </td>
                </tr>
              )}
              {data.items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  {columns.map((column) => (
                    <td key={column.label} className="px-3 py-2">
                      {column.render(item.data, item.id)}
                    </td>
                  ))}
                  <td className="px-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${item.id}`}
                      onClick={() => {
                        setEditing({ id: item.id, data: item.data });
                        setMessage(null);
                      }}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
