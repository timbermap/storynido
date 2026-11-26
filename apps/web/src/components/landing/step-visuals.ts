import type { StepVisualSpec } from './step-visual';

/** Imágenes de los pasos por línea (todas de muestra; ver StepVisual). */

/** Familias, home y Cómo funciona: foto → personaje, la aventura, el ebook en el celular. */
export const FAMILY_STEP_VISUALS: StepVisualSpec[] = [
  { kind: 'transform' },
  {
    kind: 'covers',
    covers: [
      '/samples/aventura-espacial.webp',
      '/samples/valle-de-los-dinosaurios.webp',
      '/samples/reino-encantado.webp',
    ],
  },
  { kind: 'image', src: '/images/formatos/landing-ebook.webp' },
];

/** Celebraciones: la ocasión, la muestra (invitación) y el kit para imprimir. */
export const EVENT_STEP_VISUALS: StepVisualSpec[] = [
  {
    kind: 'covers',
    covers: [
      '/samples/mi-primera-comunion.webp',
      '/samples/feliz-cumpleanos.webp',
      '/samples/mi-graduacion.webp',
    ],
  },
  { kind: 'image', src: '/images/formatos/kit-invitacion.webp' },
  { kind: 'image', src: '/images/formatos/landing-kit.webp' },
];

/** Profesionales: quien acompaña, las colecciones y un cuento por niño (lista de alias). */
export const PROFESSIONAL_STEP_VISUALS: StepVisualSpec[] = [
  { kind: 'image', src: '/images/audiencias/profesionales.webp', focus: 'object-[50%_45%]' },
  {
    kind: 'covers',
    covers: [
      '/samples/chau-panal-pro.webp',
      '/samples/mi-primer-dia-de-clases-pro.webp',
      '/samples/hermano-mayor-pro.webp',
    ],
  },
  { kind: 'image', src: '/images/heroes/pro-mesa.webp', focus: 'object-[50%_60%]' },
];
