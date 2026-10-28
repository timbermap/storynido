import { ProviderUnavailableError } from '@storynido/shared';
import { describe, expect, it } from 'vitest';

import { createProviderRegistry, providerSettingsFromEnv, simulatedProviders } from './index';

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

  it('detecta proveedores simulados, también en la lista de imprentas', () => {
    expect(simulatedProviders(providerSettingsFromEnv({}))).toContain('mock');
    const real = providerSettingsFromEnv({
      AI_TEXT_PROVIDER: 'vertex',
      AI_IMAGE_PROVIDER: 'vertex',
      PAYMENT_PROVIDER: 'stripe',
      PRINT_PROVIDERS: 'gelato,mock_alt',
      EMAIL_PROVIDER: 'resend',
      STORAGE_PROVIDER: 'gcs',
      PHOTO_ANALYZER: 'vision',
    });
    expect(simulatedProviders(real)).toEqual(['mock_alt']);
  });

  it('varias imprentas activas a la vez', () => {
    const registry = createProviderRegistry({
      ...options,
      settings: providerSettingsFromEnv({ PRINT_PROVIDERS: 'mock, mock_alt' }),
    });
    expect(registry.printers().map((printer) => printer.id)).toEqual(['mock', 'mock_alt']);
    expect(registry.printer('mock_alt')?.id).toBe('mock_alt');
    expect(registry.printer('gelato')).toBeNull();
    expect(registry.describe().active.print).toBe('mock,mock_alt');
    expect(() => providerSettingsFromEnv({ PRINT_PROVIDERS: 'mock,mock' })).toThrow();
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
