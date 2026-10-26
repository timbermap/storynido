import { CoverRotator } from './cover-rotator';

interface Cover {
  src: string;
  title: string;
}

/**
 * Libro del hero. Se renderiza en el servidor (la portada es la imagen LCP) y flota con CSS;
 * un componente mínimo de cliente alterna las portadas. Sin animación si el usuario la desactivó.
 */
export function BookShowcase({ covers }: { covers: Cover[] }) {
  const first = covers[0];
  if (!first) return null;
  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-sm [perspective:1200px]">
      <div aria-hidden="true" className="absolute -inset-6 rounded-[2rem] bg-accent/70 blur-2xl" />
      <div className="relative h-full w-full animate-[book-float_6s_ease-in-out_infinite] [transform-style:preserve-3d] motion-reduce:animate-none">
        <div className="relative h-full w-full [transform:rotateY(-12deg)_rotateX(4deg)]">
          <div className="absolute inset-y-2 -right-2 w-4 rounded-r-md bg-[repeating-linear-gradient(to_bottom,#fff,#fff_3px,#efe6d6_3px,#efe6d6_4px)] shadow-inner" />
          <div className="relative h-full overflow-hidden rounded-xl rounded-l-md shadow-2xl ring-1 ring-black/5">
            <CoverRotator covers={covers} />
            <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/25 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}
