'use client';

import { useCallback } from 'react';

import { AreaPage } from '@/components/areas/area-page';
import { api } from '@/lib/api';
import { attentionFor } from '@/lib/area-data';
import { useApi } from '@/lib/use-api';

const KINDS = [
  ['stories', 'Historias'],
  ['collections', 'Colecciones'],
  ['styles', 'Estilos'],
  ['lessons', 'Enseñanzas'],
  ['content', 'Textos'],
] as const;

/** Contenido: cuánto hay cargado y cuánto está activo en cada catálogo. */
export default function ContentSummaryPage() {
  const load = useCallback(async () => {
    const [lists, attention] = await Promise.all([
      Promise.all(KINDS.map(([kind]) => api('adminConfigList', { params: { kind } }))),
      api('adminAttention'),
    ]);
    return { lists, attention };
  }, []);
  const { data, error } = useApi(load);
  const lists = data?.lists;
  const attention = data?.attention;
  const counts = KINDS.map(([, label], i) => ({ label, total: lists?.[i]?.items.length ?? 0 }));
  const active = (lists?.[0]?.items ?? []).filter((item) => item.data.active === true).length;
  return (
    <AreaPage
      area="Contenido"
      text="Lo que ve y elige el cliente: historias, estilos, enseñanzas y textos."
      loaded={data !== null}
      error={error}
      attention={attentionFor('Contenido', attention?.items)}
      stats={[
        {
          label: 'Historias',
          value: String(counts[0]?.total ?? 0),
          hint: `${String(active)} activas`,
        },
        { label: 'Colecciones', value: String(counts[1]?.total ?? 0) },
        { label: 'Estilos', value: String(counts[2]?.total ?? 0) },
        { label: 'Enseñanzas', value: String(counts[3]?.total ?? 0) },
      ]}
      barsTitle="Cargado por catálogo"
      bars={counts.map((c) => ({ label: c.label, value: c.total }))}
    />
  );
}
