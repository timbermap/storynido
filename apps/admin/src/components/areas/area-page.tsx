'use client';

import type { AttentionItem } from '@storynido/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Card, Notice, PageHeader } from '@/components/ui/page-header';
import { itemsOfArea, type Area } from '@/lib/nav';
import { cn } from '@/lib/utils';

export interface Stat {
  label: string;
  value: string;
  hint?: string;
}
export interface Bar {
  label: string;
  value: number;
  text?: string;
}

/** Portada de un área: números, avisos del área, un gráfico de barras y las secciones. */
export function AreaPage({
  area,
  text,
  stats,
  barsTitle,
  bars,
  attention,
  error,
  loaded,
  children,
}: {
  area: Area;
  text: string;
  stats: Stat[];
  barsTitle: string;
  bars: Bar[];
  attention: AttentionItem[];
  error: string | null;
  loaded: boolean;
  children?: ReactNode;
}) {
  const max = Math.max(...bars.map((bar) => bar.value), 1);
  const sections = itemsOfArea(area).filter((item) => !item.href.startsWith('/areas/'));
  return (
    <>
      <PageHeader title={area} text={text} />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid gap-6">
        <Card>
          {attention.length === 0 ? (
            <p className="text-sm">
              <strong>Todo en orden.</strong> No hay avisos en esta área.
            </p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {attention.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      item.level === 'urgent' ? 'bg-destructive' : 'bg-amber-500',
                    )}
                  />
                  {item.title}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {loaded ? stat.value : '…'}
              </p>
              {stat.hint && <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>}
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-sm font-semibold">{barsTitle}</h2>
            {bars.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay datos.</p>
            ) : (
              <ul className="grid gap-2">
                {bars.map((bar) => (
                  <li
                    key={bar.label}
                    className="grid grid-cols-[8rem_1fr_4rem] items-center gap-2 text-sm"
                  >
                    <span className="truncate">{bar.label}</span>
                    <span className="h-2.5 rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${String(Math.max(3, (bar.value / max) * 100))}%` }}
                      />
                    </span>
                    <span className="text-right text-muted-foreground tabular-nums">
                      {bar.text ?? bar.value.toLocaleString('es')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h2 className="mb-3 text-sm font-semibold">Secciones</h2>
            <ul className="grid gap-1 text-sm">
              {sections.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex h-9 items-center gap-2 rounded-md px-2 hover:bg-accent"
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        {children}
      </div>
    </>
  );
}
