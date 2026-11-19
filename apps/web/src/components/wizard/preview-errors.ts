import { ApiError } from '@storynido/shared';

const KNOWN_ERRORS = [
  'limit_reached',
  'limit_reached_week',
  'limit_reached_book',
  'ai_unavailable',
  'ai_budget_exhausted',
  'photo_unreadable',
  'validation_failed',
  'bad_request',
  'account_required',
];

/** Código de error de la API traducible ("generic" si no lo conocemos). */
export function previewErrorKey(error: unknown): string {
  return error instanceof ApiError && KNOWN_ERRORS.includes(error.code) ? error.code : 'generic';
}

/**
 * Un error inesperado se reintenta solo una vez antes de mostrarlo (DECISIONS 284): un corte
 * pasajero (p. ej. mientras se publica una versión nueva) no llega a la persona.
 */
export async function withOneRetry<T>(action: () => Promise<T>, waitMs = 2500): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (previewErrorKey(error) !== 'generic') throw error;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return action();
  }
}
