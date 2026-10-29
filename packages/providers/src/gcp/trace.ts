import type { Span, SpanSink } from '@storynido/shared/server';
import { GoogleAuth } from 'google-auth-library';

export interface CloudTraceOptions {
  projectId: string;
  /** Cada cuánto se mandan los spans juntados (ms). */
  flushMs?: number;
  /** Con esta cantidad se mandan sin esperar. */
  maxBatch?: number;
  onError?: (error: unknown) => void;
  getAccessToken?: () => Promise<string>;
  fetch?: typeof fetch;
}

type AttributeValue =
  { stringValue: { value: string } } | { intValue: string } | { boolValue: boolean };

function attributeValue(value: string | number | boolean): AttributeValue {
  if (typeof value === 'boolean') return { boolValue: value };
  if (typeof value === 'number' && Number.isInteger(value)) return { intValue: String(value) };
  return { stringValue: { value: String(value).slice(0, 256) } };
}

/** Span en el formato de la API v2 de Cloud Trace (`traces:batchWrite`). */
export function cloudTraceSpan(projectId: string, span: Span) {
  return {
    name: `projects/${projectId}/traces/${span.traceId}/spans/${span.spanId}`,
    spanId: span.spanId,
    displayName: { value: span.name.slice(0, 128) },
    startTime: span.start.toISOString(),
    endTime: span.end.toISOString(),
    spanKind: 'SERVER',
    attributes: {
      attributeMap: Object.fromEntries(
        Object.entries(span.attributes).map(([key, value]) => [key, attributeValue(value)]),
      ),
    },
  };
}

/**
 * Manda los spans de los requests a Cloud Trace (Cloud Run no los guarda solo). Los junta y los
 * manda cada pocos segundos; si Cloud Trace falla, se pierden (nunca frenan un request).
 */
export class CloudTraceSink implements SpanSink {
  private readonly auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/trace.append'],
  });
  private pending: Span[] = [];
  private readonly timer: NodeJS.Timeout;

  constructor(readonly options: CloudTraceOptions) {
    this.timer = setInterval(() => void this.flush(), options.flushMs ?? 5_000);
    this.timer.unref();
  }

  record(span: Span): void {
    this.pending.push(span);
    if (this.pending.length >= (this.options.maxBatch ?? 50)) void this.flush();
  }

  async flush(): Promise<void> {
    if (this.pending.length === 0) return;
    const spans = this.pending;
    this.pending = [];
    try {
      const token = this.options.getAccessToken
        ? await this.options.getAccessToken()
        : await this.auth.getAccessToken();
      const res = await (this.options.fetch ?? fetch)(
        `https://cloudtrace.googleapis.com/v2/projects/${this.options.projectId}/traces:batchWrite`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${token ?? ''}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            spans: spans.map((span) => cloudTraceSpan(this.options.projectId, span)),
          }),
        },
      );
      if (!res.ok) throw new Error(`Cloud Trace ${String(res.status)}: ${await res.text()}`);
    } catch (error) {
      this.options.onError?.(error);
    }
  }

  async close(): Promise<void> {
    clearInterval(this.timer);
    await this.flush();
  }
}
