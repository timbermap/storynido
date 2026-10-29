import { Caveat, Lora, Quicksand } from 'next/font/google';

/**
 * Tipografías de la marca v3 (docs/BRAND.md): Quicksand para títulos, botones y navegación;
 * Lora para los textos de contenido; Caveat para detalles y frases emotivas. Se sirven desde el
 * propio sitio.
 */
export const fontUi = Quicksand({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-ui',
  display: 'swap',
});

export const fontContent = Lora({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-content',
  display: 'swap',
});

export const fontScript = Caveat({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-script-face',
  display: 'swap',
});
