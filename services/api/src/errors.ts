import type { ApiErrorCode } from '@storynido/shared';

/** Error con código de la API; el manejador lo traduce al formato único de error. */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const unauthorized = (message = 'Necesitás iniciar sesión.') =>
  new AppError(401, 'unauthorized', message);
export const forbidden = (message = 'No tenés permiso para esta acción.') =>
  new AppError(403, 'forbidden', message);
