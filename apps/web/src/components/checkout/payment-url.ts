/** URL del pago en otra pestaña (Gumroad): detectarla y recordarla por pedido (DECISIONS 271). */

/** Clave en sessionStorage con la URL de pago abierta en otra pestaña (la página del pedido la reabre). */
export const paymentUrlKey = (orderId: string) => `storynido:payment-url:${orderId}`;

/** ¿El cobro es en Gumroad? Ahí no hay vuelta automática: se abre en otra pestaña (DECISIONS 271). */
export function isExternalTabPayment(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'gumroad.com' || host.endsWith('.gumroad.com');
  } catch {
    return false;
  }
}

export function readPaymentUrl(orderId: string): string | null {
  try {
    return sessionStorage.getItem(paymentUrlKey(orderId));
  } catch {
    return null;
  }
}

export function rememberPaymentUrl(orderId: string, url: string) {
  try {
    sessionStorage.setItem(paymentUrlKey(orderId), url);
  } catch {
    // Sin sessionStorage (navegación privada estricta): la página del pedido igual espera el pago.
  }
}
