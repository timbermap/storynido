import { Fraunces, Nunito_Sans } from 'next/font/google';

/** Títulos: serif suave y cálida. Texto: sans muy legible. Se sirven desde el propio sitio. */
export const fontHeading = Fraunces({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

export const fontBody = Nunito_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});
