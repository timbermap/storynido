import Image from 'next/image';

import heroWatercolor from '../../../public/brand/hero-acuarela.webp';

/** Destello de cuatro puntas, decorativo. */
function Sparkle({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 1.5c.7 5.4 3.6 8.4 9 9.5-5.4 1.1-8.3 4.1-9 9.5-.7-5.4-3.6-8.4-9-9.5 5.4-1.1 8.3-4.1 9-9.5z" />
    </svg>
  );
}

/** Ilustración de acuarela del hero (imagen LCP: carga prioritaria, optimizada por Next). */
export function HeroArt({ alt }: { alt: string }) {
  return (
    <div className="relative isolate mx-auto w-full max-w-2xl">
      <div
        aria-hidden="true"
        className="absolute -inset-4 -z-10 rotate-2 rounded-[2.5rem] bg-[radial-gradient(circle_at_30%_20%,#f3e9f9_0%,var(--secondary)_55%,transparent_75%)] opacity-80 blur-md"
      />
      <Sparkle className="absolute -top-5 -left-3 z-10 size-9 rotate-12 text-star" />
      <Sparkle className="absolute -right-2 -bottom-4 z-10 size-7 text-star" />
      <div className="overflow-hidden rounded-[2rem] bg-[linear-gradient(145deg,#fff9f3,#efe4f6)] shadow-[0_17px_45px_rgb(80_52_84/0.08)]">
        <Image
          src={heroWatercolor}
          alt={alt}
          priority
          placeholder="blur"
          sizes="(min-width: 1024px) 560px, 100vw"
          className="h-auto w-full"
        />
      </div>
    </div>
  );
}
