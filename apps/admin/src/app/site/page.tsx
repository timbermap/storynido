'use client';

import { SITE_MODES, type SiteConfig } from '@storynido/shared';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, Notice, PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { SITE_MODE_INFO } from '@/lib/site-modes';
import { errorMessage, useApi } from '@/lib/use-api';

/** Interruptor general: se aplica en segundos en la web y la API, sin redeploy. */
export default function SitePage() {
  const load = useCallback(() => api('adminSiteConfig'), []);
  const { data, setData, error } = useApi(load);
  const [choice, setChoice] = useState<SiteConfig['mode'] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const selected = choice ?? data?.mode ?? 'live';

  async function save() {
    if (selected === 'maintenance' && !window.confirm('¿Poner el sitio en mantenimiento?')) return;
    setSaving(true);
    setSaveError(null);
    try {
      setData(await api('updateSiteConfig', { body: { mode: selected } }));
      setChoice(null);
    } catch (caught) {
      setSaveError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Sitio"
        text="Modo general de la web y la API. El cambio llega en unos segundos y queda en la auditoría."
      />
      {error && <Notice tone="error">{error}</Notice>}
      {data && (
        <Card className="grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="sr-only">Modo del sitio</legend>
            {SITE_MODES.map((mode) => (
              <label
                key={mode}
                className="flex cursor-pointer gap-3 rounded-md border p-3 has-[:checked]:border-primary has-[:checked]:bg-accent"
              >
                <input
                  type="radio"
                  name="mode"
                  className="mt-1 accent-[var(--primary)]"
                  checked={selected === mode}
                  onChange={() => {
                    setChoice(mode);
                  }}
                />
                <span>
                  <span className="block font-medium">
                    {SITE_MODE_INFO[mode].label}
                    {data.mode === mode && (
                      <span className="ml-2 text-xs text-muted-foreground">(actual)</span>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">{SITE_MODE_INFO[mode].text}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void save()} disabled={saving || selected === data.mode}>
              Aplicar
            </Button>
            {data.updatedAt && (
              <p className="text-xs text-muted-foreground">
                Último cambio: {new Date(data.updatedAt).toLocaleString('es')}
                {data.updatedBy && ` por ${data.updatedBy}`}
              </p>
            )}
          </div>
          {saveError && <Notice tone="error">{saveError}</Notice>}
        </Card>
      )}
    </>
  );
}
