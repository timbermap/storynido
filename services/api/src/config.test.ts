import { describe, expect, it } from 'vitest';

import { loadApiConfig } from './config';

describe('loadApiConfig', () => {
  it('en local permite los orígenes de desarrollo y no exige App Check', () => {
    const config = loadApiConfig({});
    expect(config.corsOrigins).toEqual(['http://localhost:3000', 'http://localhost:3001']);
    expect(config.appCheckEnforced).toBe(false);
    expect(config.devToolsEnabled).toBe(true);
    expect(config.projectId).toBe('demo-storynido');
  });

  it('en producción exige App Check, sin herramientas de desarrollo ni CORS implícito', () => {
    const config = loadApiConfig({ APP_ENV: 'production', GCP_PROJECT_ID: 'storynido-prod' });
    expect(config.appCheckEnforced).toBe(true);
    expect(config.devToolsEnabled).toBe(false);
    expect(config.corsOrigins).toEqual([]);
  });

  it('las variables vacías usan el valor por defecto', () => {
    const config = loadApiConfig({
      LOCAL_STORAGE_DIR: '',
      CORS_ORIGINS: '',
      RATE_LIMIT_PER_MINUTE: '',
    });
    expect(config.env.LOCAL_STORAGE_DIR).not.toBe('');
    expect(config.rateLimitPerMinute).toBe(120);
  });
});
