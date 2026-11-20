/** Error de un proveedor externo (IA, pagos, imprenta, mails, storage). */
export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly retryable = false,
    options?: ErrorOptions,
  ) {
    super(`[${provider}] ${message}`, options);
    this.name = 'ProviderError';
  }
}

/**
 * El filtro de seguridad del proveedor bloqueó el pedido o la respuesta. No es una falla pasajera:
 * repetir la misma llamada vuelve a bloquear, así que no es reintentable. El mensaje conserva
 * «bloqueado por seguridad» (hay código que lo busca).
 */
export class ContentBlockedError extends ProviderError {
  constructor(provider: string, message: string) {
    super(provider, message, false);
    this.name = 'ContentBlockedError';
  }
}

/**
 * El modelo de imágenes no devolvió ninguna imagen (respondió solo texto, vacío o bloqueó la
 * escena). No es una falla del servicio: otra escena, más simple, suele salir. Quien dibuja páginas
 * lo trata como un intento fallido y no como un error del paso (DECISIONS 298).
 */
export class ImageNotReturnedError extends ProviderError {
  constructor(provider: string, message: string) {
    super(provider, message, true);
    this.name = 'ImageNotReturnedError';
  }
}

/**
 * El cobrador no pudo cobrar con el medio de pago elegido (tarjeta rechazada, sin fondos,
 * bloqueada). No es una falla del cobrador: el comprador tiene que probar otro medio.
 */
export class PaymentDeclinedError extends ProviderError {
  constructor(provider: string, message = 'Medio de pago rechazado') {
    super(provider, message, false);
    this.name = 'PaymentDeclinedError';
  }
}

/** La firma de un webhook no es válida: la request se rechaza sin procesarla. */
export class WebhookSignatureError extends ProviderError {
  constructor(provider: string, message = 'Firma de webhook inválida') {
    super(provider, message, false);
    this.name = 'WebhookSignatureError';
  }
}

/** Se pidió un proveedor que no está disponible en esta versión. */
export class ProviderUnavailableError extends Error {
  constructor(
    readonly kind: string,
    readonly requested: string,
    readonly available: readonly string[],
  ) {
    super(
      `Proveedor de ${kind} "${requested}" no disponible. Disponibles: ${available.join(', ')}`,
    );
    this.name = 'ProviderUnavailableError';
  }
}

/** Entrada cruda de un webhook: el cuerpo exacto (para verificar la firma) y los headers. */
export interface WebhookInput {
  rawBody: string;
  headers: Readonly<Record<string, string | undefined>>;
}
