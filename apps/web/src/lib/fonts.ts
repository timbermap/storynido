import { Amatic_SC, Caveat, Lora, Quicksand } from 'next/font/google';

/**
 * Tipografías de la marca v3 (docs/BRAND.md): Quicksand para títulos, botones y navegación;
 * Lora para los textos de contenido; Caveat para detalles y frases emotivas. Se sirven desde el
 * propio sitio.
 * Sin lista de pesos: se baja la versión variable de cada una (4 archivos en lugar de 9).
 */
export const fontUi = Quicksand({
  subsets: ['latin'],
  variable: '--font-ui',
  display: 'swap',
});

export const fontContent = Lora({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-content',
  display: 'swap',
});

export const fontScript = Caveat({
  subsets: ['latin'],
  variable: '--font-script-face',
  display: 'swap',
});

/**
 * Títulos sobre las portadas: Amatic SC, letra a mano como en los libros ilustrados (elegida por
 * Sebas el 05/11). La misma del libro impreso y del PDF. Solo se usa en las portadas.
 */
export const fontCover = Amatic_SC({
  weight: '700',
  subsets: ['latin', 'latin-ext'],
  variable: '--font-cover-face',
  display: 'swap',
});
