/**
 * Fecha de un regalo (escenario 22 del informe): nunca prometer que llega antes de lo posible.
 * Los días de envío de la imprenta no incluyen crear el libro ni imprimirlo; se suman aparte.
 */

/** Días hábiles para crear el libro, revisarlo e imprimirlo antes del despacho (conservador). */
export const PRINT_PRODUCTION_BUSINESS_DAYS = 3;

/** Suma días hábiles (lunes a viernes) a una fecha, en UTC. */
export function addBusinessDays(from: Date, days: number): Date {
  const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  let left = days;
  while (left > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return date;
}

/** Entre qué fechas llegaría un libro impreso pedido hoy. */
export function deliveryWindow(now: Date, etaDaysMin: number, etaDaysMax: number) {
  return {
    earliest: addBusinessDays(now, PRINT_PRODUCTION_BUSINESS_DAYS + etaDaysMin),
    latest: addBusinessDays(now, PRINT_PRODUCTION_BUSINESS_DAYS + etaDaysMax),
  };
}

/**
 * ¿Llega para esa fecha (`AAAA-MM-DD`)?
 * - `on_time`: aun en el peor caso llega antes;
 * - `at_risk`: puede llegar, pero no está asegurado;
 * - `late`: ni en el mejor caso llega.
 */
export function giftDeadlineStatus(
  deadline: string,
  now: Date,
  etaDaysMin: number,
  etaDaysMax: number,
): 'on_time' | 'at_risk' | 'late' {
  const target = new Date(`${deadline}T00:00:00Z`);
  const { earliest, latest } = deliveryWindow(now, etaDaysMin, etaDaysMax);
  if (latest <= target) return 'on_time';
  if (earliest <= target) return 'at_risk';
  return 'late';
}
