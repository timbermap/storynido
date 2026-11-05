import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const FACES: readonly {
  family: string;
  file: string;
  weight: number;
  style: string;
  unicodeRange?: string;
}[] = [
  // Portadas: Amatic SC (letra a mano), la misma de la web. Latín (español, portugués, inglés) y
  // latín extendido, cada una con su rango para que Chromium elija el archivo por letra.
  {
    family: 'Amatic SC',
    file: '@fontsource/amatic-sc/files/amatic-sc-latin-700-normal.woff2',
    weight: 700,
    style: 'normal',
    unicodeRange:
      'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  },
  {
    family: 'Amatic SC',
    file: '@fontsource/amatic-sc/files/amatic-sc-latin-ext-700-normal.woff2',
    weight: 700,
    style: 'normal',
    unicodeRange:
      'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
  },
  {
    family: 'Fraunces',
    file: '@fontsource/fraunces/files/fraunces-latin-500-normal.woff2',
    weight: 500,
    style: 'normal',
  },
  {
    family: 'Fraunces',
    file: '@fontsource/fraunces/files/fraunces-latin-600-normal.woff2',
    weight: 600,
    style: 'normal',
  },
  {
    family: 'Fraunces',
    file: '@fontsource/fraunces/files/fraunces-latin-500-italic.woff2',
    weight: 500,
    style: 'italic',
  },
  {
    family: 'Nunito Sans',
    file: '@fontsource/nunito-sans/files/nunito-sans-latin-400-normal.woff2',
    weight: 400,
    style: 'normal',
  },
  {
    family: 'Nunito Sans',
    file: '@fontsource/nunito-sans/files/nunito-sans-latin-700-normal.woff2',
    weight: 700,
    style: 'normal',
  },
];

let cached: string | null = null;

/**
 * Tipografías de la marca embebidas en el HTML (subconjunto latino: español, portugués e
 * inglés). Chromium las incrusta en el PDF; nunca se depende de fuentes del sistema.
 */
export function fontFaces(): string {
  cached ??= FACES.map((face) => {
    const data = readFileSync(require.resolve(face.file)).toString('base64');
    const range = face.unicodeRange ? `unicode-range:${face.unicodeRange};` : '';
    return `@font-face{font-family:'${face.family}';font-weight:${String(face.weight)};font-style:${face.style};${range}src:url(data:font/woff2;base64,${data}) format('woff2');}`;
  }).join('\n');
  return cached;
}
