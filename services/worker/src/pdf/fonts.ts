import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const FACES = [
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
] as const;

let cached: string | null = null;

/**
 * Tipografías de la marca embebidas en el HTML (subconjunto latino: español, portugués e
 * inglés). Chromium las incrusta en el PDF; nunca se depende de fuentes del sistema.
 */
export function fontFaces(): string {
  cached ??= FACES.map((face) => {
    const data = readFileSync(require.resolve(face.file)).toString('base64');
    return `@font-face{font-family:'${face.family}';font-weight:${String(face.weight)};font-style:${face.style};src:url(data:font/woff2;base64,${data}) format('woff2');}`;
  }).join('\n');
  return cached;
}
