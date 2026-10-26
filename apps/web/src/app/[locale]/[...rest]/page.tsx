import { notFound } from 'next/navigation';

/** Cualquier ruta desconocida dentro de un idioma muestra el 404 traducido. */
export default function CatchAll() {
  notFound();
}
