import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function sha256Hex(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmacHex(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

/** Comparación en tiempo constante de dos firmas hex. */
export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

/** ID corto y estable a partir de una clave (idempotencia de los mocks). */
export function stableId(prefix: string, key: string): string {
  return `${prefix}_${sha256Hex(key).slice(0, 16)}`;
}
