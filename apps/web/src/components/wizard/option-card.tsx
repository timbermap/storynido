import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Opción seleccionable tipo tarjeta (radio accesible). */
export function OptionCard({
  name,
  value,
  checked,
  onSelect,
  children,
  className,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border-2 bg-card shadow-[var(--shadow-card)] transition has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
        checked ? 'border-primary bg-[#f6f1fc]' : 'border-border hover:border-primary/40',
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => {
          onSelect(value);
        }}
        className="sr-only"
      />
      {children}
      {checked && (
        <span
          aria-hidden="true"
          className="absolute top-3 right-3 grid size-7 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
        >
          ✓
        </span>
      )}
    </label>
  );
}
