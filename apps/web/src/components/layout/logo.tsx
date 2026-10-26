import { brand } from '@/lib/brand';

/** Isotipo: un nido con un libro abierto. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={className}>
      <svg viewBox="0 0 40 40" aria-hidden="true" className="size-9 shrink-0">
        <circle cx="20" cy="20" r="20" fill="var(--accent)" />
        <path
          d="M8 24c3 6 21 6 24 0"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M10 22c4 3 16 3 20 0"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity=".6"
        />
        <path
          d="M20 12c-3-2-7-2-9-1v9c2-1 6-1 9 1 3-2 7-2 9-1v-9c-2-1-6-1-9 1z"
          fill="var(--secondary)"
        />
        <path d="M20 12v9" stroke="var(--accent)" strokeWidth="1.2" />
      </svg>
      <span className="font-display text-xl font-semibold tracking-tight">{brand.name}</span>
    </span>
  );
}
