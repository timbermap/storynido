import { Caveat, Figtree, Fraunces, Lora, Quicksand } from 'next/font/google';

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
 * Títulos sobre las portadas: Fraunces, la misma del libro impreso y del PDF (más de libro y
 * menos de interfaz que Quicksand). Solo se usa en las portadas.
 */
export const fontCover = Fraunces({
  subsets: ['latin'],
  variable: '--font-cover-face',
  display: 'swap',
});

/**
 * Texto de la home con sesión (Figtree). Sin precarga: solo se baja donde se usa, así la landing
 * para visitantes no paga un archivo más.
 */
export const fontHomeBody = Figtree({
  subsets: ['latin'],
  variable: '--font-home-body',
  display: 'swap',
  preload: false,
});
