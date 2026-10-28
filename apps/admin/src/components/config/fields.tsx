'use client';

import {
  CURRENCY_MINOR_UNITS,
  fromMinorUnits,
  toMinorUnits,
  type Currency,
} from '@storynido/shared';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getPath } from '@/lib/paths';

/** Descripción de un campo del formulario (la validación final la hace la API). */
export type FieldSpec = { path: string; label: string; hint?: string } & (
  | { kind: 'text'; readOnlyOnEdit?: boolean }
  | { kind: 'number'; min?: number; max?: number; step?: number; nullable?: boolean }
  /** Monto en unidad mínima; se edita en la unidad normal de la moneda de `currencyPath`. */
  | { kind: 'money'; currencyPath: string }
  | { kind: 'boolean' }
  | {
      kind: 'select';
      options: readonly string[];
      nullable?: boolean;
      readOnlyOnEdit?: boolean;
    }
  | { kind: 'multi'; options: readonly string[] }
  /** Fecha (día UTC), guardada como ISO. */
  | { kind: 'date'; nullable?: boolean }
  /** Un monto opcional por clave (ajustes por extensión, piezas del kit). */
  | { kind: 'moneyRecord'; keys: readonly string[]; currencyPath: string; signed?: boolean }
  /** Escalones del descuento Pro. */
  | { kind: 'tiers' }
);

const inputClass = 'h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-60';

function currencyOf(data: Record<string, unknown>, path: string): Currency {
  return (getPath(data, path) as Currency | undefined) ?? 'USD';
}

function MoneyInput({
  value,
  currency,
  onChange,
  label,
  allowEmpty = false,
  signed = false,
}: {
  value: number | undefined;
  currency: Currency;
  onChange: (value: number | undefined) => void;
  label: string;
  allowEmpty?: boolean;
  signed?: boolean;
}) {
  const digits = CURRENCY_MINOR_UNITS[currency];
  return (
    <span className="flex items-center gap-1">
      <input
        type="number"
        aria-label={label}
        className={inputClass}
        step={digits === 0 ? 1 : 1 / 10 ** digits}
        min={signed ? undefined : 0}
        value={value === undefined ? '' : String(fromMinorUnits(value, currency))}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === '' && allowEmpty ? undefined : toMinorUnits(Number(raw), currency));
        }}
      />
      <span className="text-xs text-muted-foreground">{currency}</span>
    </span>
  );
}

export function FieldInput({
  field,
  data,
  editing,
  onChange,
}: {
  field: FieldSpec;
  data: Record<string, unknown>;
  editing: boolean;
  onChange: (value: unknown) => void;
}) {
  const value = getPath(data, field.path);
  switch (field.kind) {
    case 'text':
      return (
        <input
          className={inputClass}
          disabled={editing && field.readOnlyOnEdit}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          className={inputClass}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          placeholder={field.nullable ? 'Sin límite' : undefined}
          value={typeof value === 'number' ? String(value) : ''}
          onChange={(event) => {
            const raw = event.target.value;
            onChange(raw === '' && field.nullable ? null : Number(raw));
          }}
        />
      );
    case 'money':
      return (
        <MoneyInput
          label={field.label}
          value={typeof value === 'number' ? value : undefined}
          currency={currencyOf(data, field.currencyPath)}
          allowEmpty
          onChange={onChange}
        />
      );
    case 'boolean':
      return (
        <input
          type="checkbox"
          className="size-4 accent-[var(--primary)]"
          checked={value === true}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
        />
      );
    case 'select':
      return (
        <select
          className={inputClass}
          disabled={editing && field.readOnlyOnEdit}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => {
            onChange(event.target.value === '' ? null : event.target.value);
          }}
        >
          {(field.nullable === true || value === undefined) && <option value="">—</option>}
          {field.options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      );
    case 'multi': {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <span className="flex flex-wrap gap-1">
          {field.options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs has-[:checked]:border-primary has-[:checked]:bg-accent"
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selected.includes(option)}
                onChange={() => {
                  onChange(
                    selected.includes(option)
                      ? selected.filter((item) => item !== option)
                      : [...selected, option],
                  );
                }}
              />
              {option}
            </label>
          ))}
        </span>
      );
    }
    case 'date':
      return (
        <input
          type="date"
          className={inputClass}
          value={typeof value === 'string' ? value.slice(0, 10) : ''}
          onChange={(event) => {
            const raw = event.target.value;
            onChange(raw === '' && field.nullable ? null : `${raw}T00:00:00.000Z`);
          }}
        />
      );
    case 'moneyRecord': {
      const record = (value && typeof value === 'object' ? value : {}) as Record<string, number>;
      return (
        <span className="grid gap-1 sm:grid-cols-2">
          {field.keys.map((key) => (
            <label key={key} className="grid grid-cols-[6rem_1fr] items-center gap-2 text-xs">
              <span className="font-mono">{key}</span>
              <MoneyInput
                label={`${field.label}: ${key}`}
                value={record[key]}
                currency={currencyOf(data, field.currencyPath)}
                allowEmpty
                signed={field.signed}
                onChange={(next) => {
                  const rest = Object.fromEntries(
                    Object.entries(record).filter(([item]) => item !== key),
                  );
                  onChange(next === undefined ? rest : { ...rest, [key]: next });
                }}
              />
            </label>
          ))}
        </span>
      );
    }
    case 'tiers': {
      const tiers = Array.isArray(value)
        ? (value as { minPurchases: number; percent: number }[])
        : [];
      const update = (next: typeof tiers) => {
        onChange(next);
      };
      return (
        <span className="grid gap-2">
          {tiers.map((tier, index) => (
            <span key={index} className="flex items-center gap-2 text-sm">
              Desde
              <input
                type="number"
                min={1}
                aria-label="Compras"
                className={`${inputClass} w-20`}
                value={tier.minPurchases}
                onChange={(event) => {
                  update(
                    tiers.map((item, i) =>
                      i === index ? { ...item, minPurchases: Number(event.target.value) } : item,
                    ),
                  );
                }}
              />
              compras,
              <input
                type="number"
                min={0}
                max={80}
                aria-label="Porcentaje"
                className={`${inputClass} w-20`}
                value={tier.percent}
                onChange={(event) => {
                  update(
                    tiers.map((item, i) =>
                      i === index ? { ...item, percent: Number(event.target.value) } : item,
                    ),
                  );
                }}
              />
              %
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Quitar escalón"
                onClick={() => {
                  update(tiers.filter((_, i) => i !== index));
                }}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </span>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => {
              const last = tiers.at(-1);
              update([
                ...tiers,
                { minPurchases: (last?.minPurchases ?? 0) + 5, percent: (last?.percent ?? 0) + 5 },
              ]);
            }}
          >
            <Plus aria-hidden="true" /> Escalón
          </Button>
        </span>
      );
    }
  }
}
