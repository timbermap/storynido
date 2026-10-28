const PINO_TO_SEVERITY: Record<string, string> = {
  trace: 'DEBUG',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL',
};

/** Nivel de pino desde el que un log es un error (Error Reporting). */
const ERROR_LEVEL = 50;
const REPORTED_ERROR =
  'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent';

/**
 * Opciones de pino (logger de Fastify) para Cloud Logging: campo `severity`, mensaje en
 * `message` y, en los errores, lo que Error Reporting necesita para agruparlos (tipo,
 * servicio y versión, y la pila en `stack_trace`).
 */
export function cloudLoggingOptions(service: string, level: string, version = 'local') {
  return {
    level,
    messageKey: 'message',
    base: { service },
    formatters: {
      level: (label: string) => ({ severity: PINO_TO_SEVERITY[label] ?? 'DEFAULT' }),
      log: (object: Record<string, unknown>) => {
        const err = object.err as { stack?: unknown } | undefined;
        return typeof err?.stack === 'string' && !object.stack_trace
          ? { ...object, stack_trace: err.stack }
          : object;
      },
    },
    mixin: (_object: object, levelNumber: number) =>
      levelNumber >= ERROR_LEVEL
        ? { '@type': REPORTED_ERROR, serviceContext: { service, version } }
        : {},
  };
}
