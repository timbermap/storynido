import { describe, expect, it } from 'vitest';

import { cloudLoggingOptions, parseServiceEnv } from './index';

describe('server utils', () => {
  it('mapea niveles de pino a severidades de Cloud Logging', () => {
    const { formatters } = cloudLoggingOptions('api', 'info');
    expect(formatters.level('warn')).toEqual({ severity: 'WARNING' });
    expect(formatters.level('desconocido')).toEqual({ severity: 'DEFAULT' });
  });

  it('usa el puerto por defecto y respeta PORT', () => {
    expect(parseServiceEnv({}, 8080).PORT).toBe(8080);
    expect(parseServiceEnv({ PORT: '9000' }, 8080).PORT).toBe(9000);
  });

  it('rechaza variables inválidas', () => {
    expect(() => parseServiceEnv({ LOG_LEVEL: 'verbose' }, 8080)).toThrow();
  });
});
