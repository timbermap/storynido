import { brand } from '@/lib/brand';
import { cn } from '@/lib/utils';

const HEART =
  'M12 21.2C6.6 17.4 2.5 14 2.5 9.4 2.5 6.6 4.7 4.4 7.5 4.4c1.8 0 3.4 1 4.5 2.5 1.1-1.5 2.7-2.5 4.5-2.5 2.8 0 5 2.2 5 5 0 4.6-4.1 8-9.5 11.8z';

/**
 * Logo de la marca v3: "StoryNido" en Quicksand, azul profundo, con dos corazones (durazno y
 * salvia) sobre el final de la palabra. `tone="light"` para fondos oscuros.
 */
export function Logo({
  className,
  tone = 'dark',
}: {
  className?: string;
  tone?: 'dark' | 'light';
}) {
  return (
    <span className={cn('relative inline-flex items-end pt-3.5', className)}>
      <span
        className={cn(
          'font-sans text-[1.7rem] leading-none font-bold tracking-[-0.035em]',
          tone === 'light' ? 'text-white' : 'text-navy',
        )}
      >
        {brand.name}
      </span>
      {/* Los dos corazones: uno durazno, uno salvia, apenas superpuestos. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 40 26"
        className="absolute -top-1 right-[0.35rem] h-[1.6rem] w-auto"
      >
        <path d={HEART} fill="#ffb6a7" transform="translate(2 2) rotate(-12 12 12)" />
        <path d={HEART} fill="#8ac8bc" transform="translate(17 3) rotate(14 12 12) scale(0.82)" />
      </svg>
    </span>
  );
}
