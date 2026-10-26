import { CoverRotator } from './cover-rotator';

interface Cover {
  src: string;
  title: string;
}

/** Destello de cuatro puntas, decorativo. */
function Sparkle({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 1.5c.7 5.4 3.6 8.4 9 9.5-5.4 1.1-8.3 4.1-9 9.5-.7-5.4-3.6-8.4-9-9.5 5.4-1.1 8.3-4.1 9-9.5z" />
    </svg>
  );
}

/**
 * Libro del hero sobre un halo de acuarela (CSS). Se renderiza en el servidor: la portada
 * es la imagen LCP. Flota con CSS y un componente mínimo de cliente alterna las portadas.
 */
export function BookShowcase({ covers }: { covers: Cover[] }) {
  if (covers.length === 0) return null;
  return (
    <div className="relative isolate mx-auto grid min-h-[26rem] w-full max-w-lg place-items-center sm:min-h-[32rem]">
      <div
        aria-hidden="true"
        className="absolute -z-10 aspect-square w-[min(100%,30rem)] rotate-[11deg] rounded-[49%_51%_43%_57%/51%_44%_56%_49%] bg-[radial-gradient(circle_at_35%_30%,#f3e9f9_0%,var(--secondary)_45%,#d9c3e9_100%)] opacity-90 blur-[1px]"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-[6%] left-[2%] -z-10 aspect-[5/4] w-[42%] rounded-full bg-mint opacity-90 blur-[2px]"
      />
      <div
        aria-hidden="true"
        className="absolute top-[8%] right-[10%] -z-10 size-28 rounded-full bg-butter blur-sm"
      />
      <Sparkle className="absolute top-[6%] left-[6%] size-10 rotate-12 text-star" />
      <Sparkle className="absolute right-[2%] bottom-[18%] size-7 text-star" />
      <Sparkle className="absolute top-[38%] right-[0%] size-4 text-primary/40" />

      <div className="relative w-[min(72%,19rem)] animate-[book-float_6s_ease-in-out_infinite] motion-reduce:animate-none">
        <div className="relative aspect-[3/4] -rotate-[7deg] overflow-hidden rounded-[0.5rem_1rem_1rem_0.5rem] border-l-[10px] border-[#a98ac0] shadow-[var(--shadow-book)]">
          <CoverRotator covers={covers} />
          <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-white/30 to-transparent" />
        </div>
      </div>
    </div>
  );
}
