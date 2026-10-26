const PINO_TO_SEVERITY: Record<string, string> = {
  trace: 'DEBUG',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL',
};

/**
 * Opciones de pino (logger de Fastify) para que Cloud Logging interprete
 * los logs JSON: campo `severity` y mensaje en `message`.
 */
export function cloudLoggingOptions(service: string, level: string) {
  return {
    level,
    messageKey: 'message',
    base: { service },
    formatters: {
      level: (label: string) => ({ severity: PINO_TO_SEVERITY[label] ?? 'DEFAULT' }),
    },
  };
}
