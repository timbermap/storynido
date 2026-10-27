'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/**
 * Menú desplegable del encabezado: se abre al pasar el mouse o con clic/teclado, y se cierra
 * con Escape, al hacer clic afuera o al navegar.
 */
export function NavMenu({
  id,
  label,
  children,
  align = 'start',
  className,
  panelClassName = 'w-[22rem]',
}: {
  id: string;
  label: ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
  className?: string;
  /** Ancho del panel. */
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);

  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        ref.current?.querySelector('button')?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  useEffect(
    () => () => {
      clearTimeout(closeTimer.current);
    },
    [],
  );

  return (
    <div
      ref={ref}
      className={cn('relative', className)}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse') return;
        clearTimeout(closeTimer.current);
        setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'mouse') return;
        closeTimer.current = setTimeout(() => {
          setOpen(false);
        }, 150);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen((value) => !value);
        }}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 whitespace-nowrap transition-colors hover:text-primary aria-expanded:text-primary"
      >
        {label}
        <ChevronDown
          aria-hidden="true"
          className={cn('size-4 transition-transform', open && 'rotate-180')}
        />
      </button>
      <div
        id={id}
        hidden={!open}
        className={cn(
          'absolute top-full z-40 pt-3',
          panelClassName,
          align === 'end' ? 'right-0' : '-left-3',
        )}
      >
        <div className="overflow-hidden rounded-2xl border border-[rgb(55_37_75/0.08)] bg-card shadow-[0_24px_60px_-12px_rgb(52_42_64/0.22)]">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Enlace dentro de un menú: título y una línea de ayuda. */
export function NavMenuItem({
  title,
  text,
  icon,
}: {
  title: ReactNode;
  text?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <span className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors group-hover:bg-[#f6f1f8]">
      {icon && (
        <span
          aria-hidden="true"
          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-[#f6f1f8] text-primary"
        >
          {icon}
        </span>
      )}
      <span className="grid gap-0.5">
        <span className="font-semibold text-foreground">{title}</span>
        {text && <span className="text-sm leading-snug text-muted-foreground">{text}</span>}
      </span>
    </span>
  );
}
