import { ApiError } from '@storynido/shared';

const KNOWN_ERRORS = [
  'limit_reached',
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
