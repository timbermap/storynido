'use client';

import { AI_ENVIRONMENTS, aiModelProblems, aiModelSchema } from '@storynido/shared';

import { ConfigEditor } from '@/components/config/config-editor';
import { Notice } from '@/components/ui/page-header';
import { yesNo } from '@/lib/format';

/** Advertencias de la política del modelo (las mismas reglas que hace cumplir la API). */
function PolicyNotice({ data }: { data: Record<string, unknown> }) {
  const parsed = aiModelSchema.safeParse(data);
  if (!parsed.success) return null;
  const production = aiModelProblems(parsed.data, 'production');
  const trains = parsed.data.dataPolicy.trainsOnData || parsed.data.dataPolicy.humanReview;
  return (
    <div className="grid gap-2">
      {production.length > 0 && <Notice tone="error">{production.join(' ')}</Notice>}
      {trains && (
        <Notice tone="error">
          Fuera de producción solo con el modo sin foto y datos sintéticos: nunca fotos ni datos
          reales de chicos.
        </Notice>
      )}
      {!parsed.data.price && (
        <Notice>
          Sin precio cargado: cada llamada se cobra con el peor caso (USD 2 / 120 por millón).
        </Notice>
      )}
    </div>
  );
}

export default function AiModelsPage() {
  return (
    <ConfigEditor
      kind="aiModels"
      title="Modelos de IA"
      text="Catálogo de modelos: precio, política de datos, ambientes y si puede recibir fotos de chicos. Solo el superadmin lo cambia; la API hace cumplir las reglas al elegir el modelo en IA."
      idFrom={(data) => String(data.model)}
      blank={() => ({
        provider: 'vertex',
        model: '',
        kind: 'text',
        price: { inputPerMTok: 0, outputPerMTok: 0 },
        dataPolicy: {
          trainsOnData: false,
          humanReview: false,
          regions: ['global'],
          enterpriseAgreement: false,
        },
        allowedEnvironments: ['local', 'staging'],
        childPhotosAllowed: false,
        lastEval: null,
        notes: null,
      })}
      fields={[
        { kind: 'text', path: 'provider', label: 'Proveedor' },
        { kind: 'text', path: 'model', label: 'Modelo', readOnlyOnEdit: true },
        { kind: 'select', path: 'kind', label: 'Tipo', options: ['text', 'image'] },
        {
          kind: 'number',
          path: 'price.inputPerMTok',
          label: 'USD por millón (entrada)',
          min: 0,
          step: 0.01,
        },
        {
          kind: 'number',
          path: 'price.outputPerMTok',
          label: 'USD por millón (salida)',
          min: 0,
          step: 0.01,
        },
        { kind: 'boolean', path: 'dataPolicy.trainsOnData', label: 'Entrena con los datos' },
        { kind: 'boolean', path: 'dataPolicy.humanReview', label: 'Revisión humana' },
        {
          kind: 'boolean',
          path: 'dataPolicy.enterpriseAgreement',
          label: 'Contrato de datos empresarial firmado',
        },
        { kind: 'tags', path: 'dataPolicy.regions', label: 'Regiones' },
        {
          kind: 'multi',
          path: 'allowedEnvironments',
          label: 'Ambientes permitidos',
          options: AI_ENVIRONMENTS,
        },
        { kind: 'boolean', path: 'childPhotosAllowed', label: 'Puede recibir fotos de chicos' },
        {
          kind: 'json',
          path: 'lastEval',
          label: 'Última evaluación',
          hint: '{ "date": "2026-10-28", "summary": "…", "reportUrl": null } (pnpm eval:character)',
          rows: 4,
        },
        { kind: 'textarea', path: 'notes', label: 'Notas', rows: 2 },
      ]}
      extra={(data) => <PolicyNotice data={data} />}
      columns={[
        { label: 'Modelo', render: (_, id) => <span className="font-mono text-xs">{id}</span> },
        { label: 'Tipo', render: (data) => String(data.kind) },
        {
          label: 'Precio (entrada / salida)',
          render: (data) => {
            const price = data.price as { inputPerMTok: number; outputPerMTok: number } | null;
            return price
              ? `${String(price.inputPerMTok)} / ${String(price.outputPerMTok)}`
              : 'peor caso';
          },
        },
        {
          label: 'Fotos',
          render: (data) => yesNo(data.childPhotosAllowed),
        },
        {
          label: 'Ambientes',
          render: (data) =>
            Array.isArray(data.allowedEnvironments) ? data.allowedEnvironments.join(', ') : '—',
        },
      ]}
    />
  );
}
