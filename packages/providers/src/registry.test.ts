import { ProviderUnavailableError } from '@storynido/shared';
import { describe, expect, it } from 'vitest';

import { createProviderRegistry, providerSettingsFromEnv } from './index';

const options = {
  mockWebhookSecret: 's',
  localStorage: {
    rootDir: '/tmp/storynido-registry-test',
    publicBaseUrl: 'http://localhost:8080',
    secret: 's',
  },
};

describe('ProviderRegistry', () => {
  it('por defecto usa mocks y storage local', () => {
    const registry = createProviderRegistry({ ...options, settings: providerSettingsFromEnv({}) });
    expect(registry.describe().active).toEqual({
      aiText: 'mock',
      aiImage: 'mock',
      payment: 'mock',
      print: 'mock',
      email: 'mock',
      storage: 'local',
      photoAnalyzer: 'mock',
    });
    expect(registry.payment().id).toBe('mock');
    expect(registry.payment()).toBe(registry.payment());
  });

  it('falla al arrancar si se pide un proveedor no disponible', () => {
    expect(() =>
      createProviderRegistry({
        ...options,
        settings: providerSettingsFromEnv({ PAYMENT_PROVIDER: 'stripe' }),
      }),
    ).toThrow(ProviderUnavailableError);
    expect(() => providerSettingsFromEnv({ PAYMENT_PROVIDER: 'paypal' })).toThrow();
  });

  it('la configuración de IA del admin solo acepta proveedores disponibles', () => {
    const registry = createProviderRegistry({ ...options, settings: providerSettingsFromEnv({}) });
    expect(() => {
      registry.setAiOverride({ text: 'vertex' });
    }).toThrow(ProviderUnavailableError);
    registry.setAiOverride({ text: 'mock' });
    expect(registry.ai().text.id).toBe('mock');
  });
});
