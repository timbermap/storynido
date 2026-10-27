import { brand } from '@/lib/brand';
import { cn } from '@/lib/utils';

/**
 * Logo provisorio: corazón lavanda con un destello y el nombre en la serif de la marca.
 * `tone="light"` para fondos oscuros.
 */
export function Logo({
  className,
  tone = 'dark',
}: {
  className?: string;
  tone?: 'dark' | 'light';
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg aria-hidden="true" viewBox="0 0 32 32" className="size-7 shrink-0">
        <path
          d="M16 27.5C9 22.6 4 18.4 4 12.6 4 9 6.8 6.3 10.2 6.3c2.4 0 4.5 1.3 5.8 3.3 1.3-2 3.4-3.3 5.8-3.3 3.4 0 6.2 2.7 6.2 6.3 0 5.8-5 10-12 14.9z"
          fill={tone === 'light' ? '#cdb4e0' : 'var(--primary)'}
        />
        <path
          d="M16 11.2c.4 2.8 1.8 4.3 4.5 4.8-2.7.5-4.1 2-4.5 4.8-.4-2.8-1.8-4.3-4.5-4.8 2.7-.5 4.1-2 4.5-4.8z"
          fill={tone === 'light' ? '#2e2338' : '#fff'}
        />
      </svg>
      <span
        className={cn(
          'font-display text-[1.55rem] leading-none font-semibold tracking-[-0.03em]',
          tone === 'light' ? 'text-white' : 'text-foreground',
        )}
      >
        {brand.name}
      </span>
    </span>
  );
}
