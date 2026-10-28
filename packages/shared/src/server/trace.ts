import { createHash, randomInt } from 'node:crypto';

/**
 * Traza de un pedido (fase 16): un ID de Cloud Trace derivado del número de pedido. El worker lo
 * manda en `X-Cloud-Trace-Context` a Cloud Tasks y Workflows, así Cloud Run agrupa todos los
 * pasos del pedido en una sola traza, y cada línea de log del pedido la lleva.
 */
export function orderTraceId(orderId: string): string {
  return createHash('sha256').update(`order:${orderId}`).digest('hex').slice(0, 32);
}

/** Cabecera de Cloud Trace para continuar la traza del pedido en otro servicio. */
export function cloudTraceHeader(traceId: string): string {
  // El span es un número decimal de 64 bits; uno al azar por llamada.
  return `${traceId}/${String(randomInt(1, 2 ** 47))};o=1`;
}

const TRACE = 'logging.googleapis.com/trace';
const SPAN = 'logging.googleapis.com/spanId';
const SAMPLED = 'logging.googleapis.com/trace_sampled';

/**
 * Campos de log que Cloud Logging usa para unir el log con su traza. Acepta la cabecera de
 * Cloud Trace (`TRACE/SPAN;o=1`) o la W3C (`00-TRACE-SPAN-01`). Sin cabecera, nada.
 */
export function traceLogFields(
  header: string | undefined,
  projectId: string,
): Record<string, string | boolean> {
  if (!header) return {};
  const w3c = /^[\da-f]{2}-([\da-f]{32})-([\da-f]{16})-([\da-f]{2})$/i.exec(header);
  const cloud = /^([\da-f]{32})(?:\/(\d+))?(?:;o=(\d))?/i.exec(header);
  const trace = w3c?.[1] ?? cloud?.[1];
  if (!trace) return {};
  const span = w3c?.[2] ?? (cloud?.[2] ? BigInt(cloud[2]).toString(16).padStart(16, '0') : null);
  return {
    [TRACE]: `projects/${projectId}/traces/${trace.toLowerCase()}`,
    ...(span ? { [SPAN]: span } : {}),
    [SAMPLED]: w3c ? w3c[3] === '01' : cloud?.[3] === '1',
  };
}

/** Campos de log de un pedido: su número y su traza (para encontrar todo lo que le pasó). */
export function orderLogFields(orderId: string, projectId: string) {
  return { orderId, [TRACE]: `projects/${projectId}/traces/${orderTraceId(orderId)}` };
}
