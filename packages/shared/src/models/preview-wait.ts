/**
 * Cuánto suele tardar la muestra, para «Suele estar en unos N minutos». Sale de los tiempos
 * reales de staging (24/10–05/11/2026, solo las que salieron bien), redondeando hacia arriba
 * el percentil 90:
 * - Escribir el cuento y dibujar al personaje: n=16, mediana 106 s, p90 148 s → 3 minutos.
 * - Portada y 2 páginas tras aprobarlo: n=7, mediana 55 s, p90 ~57–71 s → 2 minutos.
 * - Con su dibujo (texto y luego ilustraciones, todo junto): pocos datos todavía; se suma lo
 *   anterior sin la lámina, con margen → 4 minutos. Revisar cuando haya más muestras.
 */
export const PREVIEW_WAIT_MINUTES = {
  character: 3,
  illustrate: 2,
  withDrawing: 4,
} as const;

export type PreviewWaitKind = keyof typeof PREVIEW_WAIT_MINUTES;
