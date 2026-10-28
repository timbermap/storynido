'use client';

import type { AiConfig } from '@storynido/shared';
import { useCallback, useState, type ReactNode, type SubmitEvent } from 'react';

import { useAdminAuth } from '@/components/auth/admin-auth';
import { AiCosts } from '@/components/dashboard/ai-costs';
import { Button } from '@/components/ui/button';
import { Card, Notice, PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { errorMessage, useApi } from '@/lib/use-api';

type Editable = Omit<AiConfig, 'updatedAt' | 'updatedBy'>;

const inputClass = 'h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-60';

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** Proveedor y modelo de texto e imagen, límites y presupuesto. Solo el superadmin cambia. */
export default function AiPage() {
  const { role } = useAdminAuth();
  const canEdit = role === 'superadmin';
  const load = useCallback(() => api('adminAiConfig'), []);
  const { data, setData, error } = useApi(load);
  const [draft, setDraft] = useState<Partial<Editable>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  if (!data) {
    return (
      <>
        <PageHeader title="IA" />
        {error ? <Notice tone="error">{error}</Notice> : <p role="status">Cargando…</p>}
      </>
    );
  }
  const value: Editable = { ...data.config, ...draft };
  const set = <K extends keyof Editable>(key: K, next: Editable[K]) => {
    setDraft((current) => ({ ...current, [key]: next }));
  };
  const changes = Object.fromEntries(
    Object.entries(draft).filter(([key, next]) => data.config[key as keyof Editable] !== next),
  ) as Partial<Editable>;

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      setData(await api('updateAiConfig', { body: changes }));
      setDraft({});
      setMessage({
        text: 'Guardado. El cambio ya está en uso y quedó en la auditoría.',
        error: false,
      });
    } catch (caught) {
      setMessage({ text: errorMessage(caught), error: true });
    } finally {
      setSaving(false);
    }
  }

  const number = (key: keyof Editable, step = 1) => (
    <input
      type="number"
      step={step}
      min={0}
      className={inputClass}
      disabled={!canEdit}
      value={String(value[key])}
      onChange={(event) => {
        set(key, Number(event.target.value) as never);
      }}
    />
  );

  return (
    <>
      <PageHeader
        title="IA"
        text={`Gasto de hoy: USD ${data.spentTodayUsd.toFixed(2)}. ${canEdit ? '' : 'Solo el superadmin puede cambiarla.'}`}
      />
      <form onSubmit={(event) => void save(event)} className="grid gap-4">
        <Card className="grid gap-4 sm:grid-cols-2">
          <Field label="Proveedor de texto">
            <select
              className={inputClass}
              disabled={!canEdit}
              value={value.textProvider}
              onChange={(event) => {
                set('textProvider', event.target.value as Editable['textProvider']);
              }}
            >
              {data.available.text.map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </Field>
          <Field label="Modelo de texto">
            <input
              className={inputClass}
              disabled={!canEdit}
              value={value.textModel}
              onChange={(event) => {
                set('textModel', event.target.value);
              }}
            />
          </Field>
          <Field label="Proveedor de imagen">
            <select
              className={inputClass}
              disabled={!canEdit}
              value={value.imageProvider}
              onChange={(event) => {
                set('imageProvider', event.target.value as Editable['imageProvider']);
              }}
            >
              {data.available.image.map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </Field>
          <Field label="Modelo de imagen">
            <input
              className={inputClass}
              disabled={!canEdit}
              value={value.imageModel}
              onChange={(event) => {
                set('imageModel', event.target.value);
              }}
            />
          </Field>
        </Card>
        <Card className="grid gap-4 sm:grid-cols-2">
          <Field label="Regeneraciones por libro">{number('maxRegenerationsPerBook')}</Field>
          <Field label="Vistas previas por usuario y día">
            {number('maxPreviewsPerUserPerDay')}
          </Field>
          <Field
            label="Presupuesto diario (USD)"
            hint="Al llegar, la IA se corta sola hasta mañana."
          >
            {number('dailyBudgetUsd', 0.5)}
          </Field>
          <Field label="Alerta al (% del presupuesto)">{number('budgetAlertPercent')}</Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="accent-[var(--primary)]"
              disabled={!canEdit}
              checked={value.illustrationsRequireAccount}
              onChange={(event) => {
                set('illustrationsRequireAccount', event.target.checked);
              }}
            />
            Ilustrar la muestra pide cuenta (la etapa 1 sigue sin cuenta)
          </label>
        </Card>
        {canEdit && (
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving || Object.keys(changes).length === 0}>
              Guardar cambios
            </Button>
            {data.config.updatedBy && (
              <p className="text-xs text-muted-foreground">
                Último cambio por {data.config.updatedBy}
              </p>
            )}
          </div>
        )}
        {message && <Notice tone={message.error ? 'error' : 'info'}>{message.text}</Notice>}
      </form>
      <AiCosts />
    </>
  );
}
