'use client';

import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface AgeTab {
  key: string;
  label: string;
  /** «0 a 2 años». */
  range: string;
}

/**
 * Pestañas por edad: cada una muestra sus historias (ya armadas en el servidor). El resto de los
 * paneles quedan en la página, ocultos, así el contenido se ve igual sin JavaScript para buscadores.
 */
export function AgeTabs({
  tabs,
  panels,
  initial = 0,
}: {
  tabs: AgeTab[];
  panels: ReactNode[];
  initial?: number;
}) {
  const id = useId();
  const [active, setActive] = useState(Math.min(initial, Math.max(tabs.length - 1, 0)));

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (active + step + tabs.length) % tabs.length;
    setActive(next);
    document.getElementById(`${id}-tab-${String(next)}`)?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        onKeyDown={onKeyDown}
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            id={`${id}-tab-${String(index)}`}
            type="button"
            role="tab"
            aria-selected={active === index}
            aria-controls={`${id}-panel-${String(index)}`}
            tabIndex={active === index ? 0 : -1}
            onClick={() => {
              setActive(index);
            }}
            className={cn(
              'grid gap-0.5 rounded-2xl border px-4 py-3 text-left transition',
              active === index
                ? 'border-peach bg-peach text-foreground shadow-[var(--shadow-card)]'
                : 'bg-card hover:border-foreground/40',
            )}
          >
            <span className="font-display text-base font-bold">{tab.label}</span>
            <span
              className={cn(
                'text-sm',
                active === index ? 'text-foreground/75' : 'text-muted-foreground',
              )}
            >
              {tab.range}
            </span>
          </button>
        ))}
      </div>
      {panels.map((panel, index) => (
        <div
          key={tabs[index]?.key ?? index}
          id={`${id}-panel-${String(index)}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${String(index)}`}
          hidden={active !== index}
          className="mt-6"
        >
          {panel}
        </div>
      ))}
    </div>
  );
}
