import { createHash, randomBytes, randomInt } from 'node:crypto';

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

/** Traza de un request: ID de la traza, span del que llama (hex) y si se muestrea. */
export interface TraceContext {
  traceId: string;
  spanId: string | null;
  sampled: boolean;
}

/** Lee la cabecera de Cloud Trace (`TRACE/SPAN;o=1`) o la W3C (`00-TRACE-SPAN-01`). */
export function parseTraceHeader(header: string | undefined): TraceContext | null {
  if (!header) return null;
  const w3c = /^[\da-f]{2}-([\da-f]{32})-([\da-f]{16})-([\da-f]{2})$/i.exec(header);
  const cloud = /^([\da-f]{32})(?:\/(\d+))?(?:;o=(\d))?/i.exec(header);
  const trace = w3c?.[1] ?? cloud?.[1];
  if (!trace) return null;
  const span = w3c?.[2] ?? (cloud?.[2] ? BigInt(cloud[2]).toString(16).padStart(16, '0') : null);
  return {
    traceId: trace.toLowerCase(),
    spanId: span?.toLowerCase() ?? null,
    sampled: w3c ? w3c[3] === '01' : cloud?.[3] === '1',
  };
}

/**
 * Campos de log que Cloud Logging usa para unir el log con su traza. Sin cabecera, nada.
 */
export function traceLogFields(
  header: string | undefined,
  projectId: string,
): Record<string, string | boolean> {
  const context = parseTraceHeader(header);
  if (!context) return {};
  return {
    [TRACE]: `projects/${projectId}/traces/${context.traceId}`,
    ...(context.spanId ? { [SPAN]: context.spanId } : {}),
    [SAMPLED]: context.sampled,
  };
}

/** Un tramo de una traza (un request atendido). */
export interface Span {
  traceId: string;
  spanId: string;
  name: string;
  start: Date;
  end: Date;
  attributes: Record<string, string | number | boolean>;
}

/** Destino de los spans (Cloud Trace en la nube). */
export interface SpanSink {
  record(span: Span): void;
  flush(): Promise<void>;
}

/**
 * Span de un request atendido, solo si viene muestreado. Usa el span de la cabecera como propio:
 * es el que llevan los logs del request, así Cloud Trace los muestra juntos.
 */
export function requestSpan(
  header: string | undefined,
  request: { method: string; route: string; status: number; elapsedMs: number; service: string },
  now = new Date(),
): Span | null {
  const context = parseTraceHeader(header);
  if (!context?.sampled) return null;
  return {
    traceId: context.traceId,
    spanId: context.spanId ?? randomBytes(8).toString('hex'),
    name: `${request.service} ${request.method} ${request.route}`,
    start: new Date(now.getTime() - Math.round(request.elapsedMs)),
    end: now,
    attributes: {
      '/http/method': request.method,
      '/http/route': request.route,
      '/http/status_code': request.status,
      'g.co/gae/app/module': request.service,
    },
  };
}

/** Campos de log de un pedido: su número y su traza (para encontrar todo lo que le pasó). */
export function orderLogFields(orderId: string, projectId: string) {
  return { orderId, [TRACE]: `projects/${projectId}/traces/${orderTraceId(orderId)}` };
}
