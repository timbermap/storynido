/**
 * Eventos de conversión (decisión 179): vista previa creada, pago iniciado y compra. Llevan solo
 * valor, moneda, línea y el id opaco del pedido, nunca datos del niño ni de la persona. Cada uno se
 * manda una sola vez por libro o pedido, y solo si hay consentimiento (lo decide `Analytics`).
 */
export type ConversionName = 'preview_created' | 'begin_checkout' | 'purchase';

export interface ConversionDetail {
  name: ConversionName;
  /** Total en la unidad de la moneda (no en centavos). */
  value?: number;
  currency?: string;
  /** Id opaco del pedido (deduplica la compra en Analytics). */
  transactionId?: string;
  line?: string;
}

export const CONVERSION_EVENT = 'sn:conversion';

/** Avisa de una conversión; si ya se mandó con esa clave en este navegador, no repite. */
export function trackConversion(key: string, detail: ConversionDetail): void {
  try {
    const storageKey = `sn_conv:${key}`;
    if (window.localStorage.getItem(storageKey)) return;
    window.localStorage.setItem(storageKey, '1');
  } catch {
    // Sin storage: se manda igual (el peor caso es repetir el evento en la misma visita).
  }
  window.dispatchEvent(new CustomEvent<ConversionDetail>(CONVERSION_EVENT, { detail }));
}
