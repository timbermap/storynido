'use client';

import { useState } from 'react';

export interface DailyPoint {
  day: string;
  value: number;
  /** Lo que muestra el tooltip además del valor. */
  detail: string;
  /** El día de hoy (todavía en curso). */
  partial?: boolean;
}

const HEIGHT = 180;
const AXIS = 52;
/** Aire arriba para la etiqueta de la línea superior. */
const TOP = 10;
const BAR_MAX = 24;

const usd = (value: number) =>
  value.toLocaleString('es', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const axisLabel = (value: number) =>
  `$${value.toLocaleString('es', { notation: 'compact', maximumFractionDigits: 1 })}`;

/** Barras por día (una serie): eje en USD, grilla tenue y tooltip al pasar el mouse o el foco. */
export function DailyBars({ points, label }: { points: DailyPoint[]; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((point) => point.value));
  // Tres líneas de grilla redondeadas hacia arriba.
  const step = Math.ceil(max / 3 / 10) * 10 || 1;
  const top = step * 3;
  const width = Math.max(320, points.length * 28 + AXIS);
  const band = (width - AXIS) / points.length;
  const bar = Math.min(BAR_MAX, band - 2);
  const y = (value: number) => TOP + (HEIGHT - TOP) - (value / top) * (HEIGHT - TOP);
  const current = active === null ? null : points[active];

  return (
    <figure className="relative">
      <svg
        viewBox={`0 0 ${String(width)} ${String(HEIGHT + 24)}`}
        className="h-auto w-full"
        role="img"
        aria-label={label}
      >
        {[0, 1, 2, 3].map((index) => {
          const value = step * index;
          return (
            <g key={index}>
              <line
                x1={AXIS}
                x2={width}
                y1={y(value)}
                y2={y(value)}
                className="stroke-chart-grid"
                strokeWidth={1}
              />
              <text
                x={AXIS - 6}
                y={y(value) + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {axisLabel(value)}
              </text>
            </g>
          );
        })}
        {points.map((point, index) => {
          const height = Math.max(0, HEIGHT - y(point.value));
          const x = AXIS + index * band + (band - bar) / 2;
          const radius = Math.min(4, height / 2);
          return (
            <g
              key={point.day}
              tabIndex={0}
              role="button"
              aria-label={`${point.day}: ${usd(point.value)}. ${point.detail}`}
              onMouseEnter={() => {
                setActive(index);
              }}
              onMouseLeave={() => {
                setActive(null);
              }}
              onFocus={() => {
                setActive(index);
              }}
              onBlur={() => {
                setActive(null);
              }}
              className="outline-none"
            >
              {/* Zona de hover más grande que la barra. */}
              <rect x={AXIS + index * band} y={0} width={band} height={HEIGHT} fill="transparent" />
              {height > 0 && (
                <path
                  // Extremo redondeado de 4px arriba y recto en la base.
                  d={`M${String(x)},${String(HEIGHT)} V${String(HEIGHT - height + radius)} Q${String(x)},${String(HEIGHT - height)} ${String(x + radius)},${String(HEIGHT - height)} H${String(x + bar - radius)} Q${String(x + bar)},${String(HEIGHT - height)} ${String(x + bar)},${String(HEIGHT - height + radius)} V${String(HEIGHT)} Z`}
                  className="fill-chart-1"
                  opacity={point.partial ? 0.55 : active === null || active === index ? 1 : 0.6}
                />
              )}
              {(index === 0 || index === points.length - 1 || points.length <= 10) && (
                <text
                  x={x + bar / 2}
                  y={HEIGHT + 16}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {point.day.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {current && (
        <figcaption
          role="status"
          className="pointer-events-none absolute top-0 right-0 rounded-md border bg-card px-3 py-2 text-xs shadow-sm"
        >
          <p className="font-semibold">
            {current.day}
            {current.partial ? ' (en curso)' : ''}
          </p>
          <p className="tabular-nums">{usd(current.value)}</p>
          <p className="text-muted-foreground">{current.detail}</p>
        </figcaption>
      )}
    </figure>
  );
}
