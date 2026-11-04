import type { ReactNode } from 'react';

export function PageHeader({
  title,
  text,
  actions,
  level = 1,
}: {
  title: string;
  text?: string;
  actions?: ReactNode;
  /** 2: un bloque más de la misma página (debajo del título principal). */
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <header
      className={`mb-6 flex flex-wrap items-end justify-between gap-3 ${level === 2 ? 'mt-10' : ''}`}
    >
      <div>
        <Heading className={level === 1 ? 'text-2xl font-semibold' : 'text-xl font-semibold'}>
          {title}
        </Heading>
        {text && <p className="mt-1 text-sm text-muted-foreground">{text}</p>}
      </div>
      {actions}
    </header>
  );
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'error';
  children: ReactNode;
}) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={
        tone === 'error'
          ? 'rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'
          : 'rounded-md border bg-accent px-3 py-2 text-sm'
      }
    >
      {children}
    </p>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border bg-card p-4 ${className}`}>{children}</section>;
}
