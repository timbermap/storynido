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
