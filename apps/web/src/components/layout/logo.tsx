import { brand } from '@/lib/brand';

/** Símbolo provisorio: estrella de cuatro puntas sobre lavanda (exploración, no logo final). */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span
        aria-hidden="true"
        className="inline-grid size-9 shrink-0 -rotate-6 place-items-center rounded-[0.8rem] bg-secondary text-primary"
      >
        <svg viewBox="0 0 24 24" className="size-5 rotate-6" fill="currentColor">
          <path d="M12 1.5c.7 5.4 3.6 8.4 9 9.5-5.4 1.1-8.3 4.1-9 9.5-.7-5.4-3.6-8.4-9-9.5 5.4-1.1 8.3-4.1 9-9.5z" />
        </svg>
      </span>
      <span className="font-sans text-[1.55rem] font-black tracking-[-0.055em] text-primary">
        {brand.name}
      </span>
    </span>
  );
}
