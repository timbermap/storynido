import Image from 'next/image';

/** Qué muestra cada paso de los «Cómo funciona» (en lugar del ícono o el número solo). */
export type StepVisualSpec =
  /** La foto de muestra se vuelve personaje (polaroid → dibujo). */
  | { kind: 'transform' }
  /** Abanico de 3 tapas del catálogo que se abre al pasar el mouse. */
  | { kind: 'covers'; covers: readonly [string, string, string] }
  /** Una foto o ilustración de muestra. */
  | { kind: 'image'; src: string; focus?: string };

const FRAME =
  'relative mx-auto aspect-[16/10] w-full max-w-[17rem] overflow-hidden rounded-[1.75rem] bg-card shadow-[var(--shadow-card)] md:aspect-[4/3] md:max-w-[19rem]';

const POLAROID =
  'relative rounded-md bg-white p-1.5 pb-5 shadow-[0_10px_22px_-10px_rgb(38_50_74/0.45)]';

/**
 * Imagen de un paso. Todo es de muestra (nunca libros ni fotos de clientes) y decorativo: el
 * título del paso ya lo explica.
 */
export function StepVisual({ spec }: { spec: StepVisualSpec }) {
  if (spec.kind === 'transform') {
    return (
      <div className={`${FRAME} grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-5`}>
        {(['/images/secciones/foto-real.webp', '/images/secciones/personaje.webp'] as const).map(
          (src, index) => (
            <span key={src} className={`${POLAROID} ${index === 0 ? '-rotate-6' : 'rotate-3'}`}>
              <span className="relative block aspect-square overflow-hidden rounded-sm">
                <Image src={src} alt="" fill unoptimized sizes="130px" className="object-cover" />
              </span>
            </span>
          ),
        )}
        <span
          aria-hidden="true"
          className="col-start-2 row-start-1 text-2xl font-bold text-[#a33f33]"
        >
          →
        </span>
      </div>
    );
  }

  if (spec.kind === 'covers') {
    const place = [
      '-translate-x-[68%] -rotate-[10deg] group-hover:-translate-x-[82%] group-hover:-rotate-[14deg]',
      'z-10 -translate-y-1 group-hover:-translate-y-3',
      'translate-x-[68%] rotate-[10deg] group-hover:translate-x-[82%] group-hover:rotate-[14deg]',
    ];
    return (
      <div
        className={`${FRAME} group grid place-items-center bg-[linear-gradient(160deg,#fff7f2,#ffe7df)]`}
      >
        {spec.covers.map((src, index) => (
          <span
            key={src}
            className={`absolute top-[14%] w-[34%] overflow-hidden rounded-lg shadow-[0_14px_26px_-12px_rgb(38_50_74/0.55)] transition duration-500 ease-out ${place[index] ?? ''}`}
          >
            <span className="relative block aspect-[3/4]">
              <Image src={src} alt="" fill unoptimized sizes="110px" className="object-cover" />
            </span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={FRAME}>
      <Image
        src={spec.src}
        alt=""
        fill
        unoptimized
        sizes="304px"
        className={`object-cover ${spec.focus ?? 'object-center'}`}
      />
    </div>
  );
}
