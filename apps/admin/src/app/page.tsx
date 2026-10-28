'use client';

import Link from 'next/link';
import { useCallback } from 'react';

import { Card, Notice, PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { SITE_MODE_INFO } from '@/lib/site-modes';
import { useApi } from '@/lib/use-api';

const usd = (value: number) =>
  value.toLocaleString('es', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

/** Resumen: estado del sitio y gasto de IA de hoy (las métricas de ventas llegan después). */
export default function SummaryPage() {
  const load = useCallback(() => Promise.all([api('adminSiteConfig'), api('adminAiConfig')]), []);
  const { data, error } = useApi(load);
  const [site, ai] = data ?? [];
  const budget = ai?.config.dailyBudgetUsd ?? 0;
  const percent = ai && budget > 0 ? Math.round((ai.spentTodayUsd / budget) * 100) : null;

  return (
    <>
      <PageHeader title="Resumen" />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-muted-foreground">Modo del sitio</p>
          <p className="mt-1 text-2xl font-semibold">
            {site ? SITE_MODE_INFO[site.mode].label : '…'}
          </p>
          <Link href="/site" className="mt-2 inline-block text-sm text-primary underline">
            Cambiar
          </Link>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Gasto de IA hoy</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {ai ? usd(ai.spentTodayUsd) : '…'}
            {ai && <span className="text-base font-normal"> / {usd(budget)}</span>}
          </p>
          {percent !== null && (
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
              role="meter"
              aria-label="Presupuesto diario usado"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={`h-full ${percent >= (ai?.config.budgetAlertPercent ?? 80) ? 'bg-destructive' : 'bg-primary'}`}
                style={{ width: `${String(Math.min(percent, 100))}%` }}
              />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
