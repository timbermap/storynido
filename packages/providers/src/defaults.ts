import type { EmailMessage } from '@storynido/shared';

import { LocalStorageService } from './local/storage';
import { MockAIImageProvider, MockAITextProvider } from './mock/ai';
import { MockEmailProvider } from './mock/email';
import { MockPaymentProvider } from './mock/payment';
import { MockPrintProvider } from './mock/print';
import { ProviderRegistry, type ProviderFactories, type ProviderSettings } from './registry';

export interface DefaultProviderOptions {
  settings: ProviderSettings;
  /** Secreto de firma de los webhooks simulados (solo local; no es una clave real). */
  mockWebhookSecret: string;
  localStorage: { rootDir: string; publicBaseUrl: string; secret: string };
  onMockEmail?: (message: EmailMessage) => void;
}

/** Implementaciones disponibles hoy. Las reales se suman acá en cada fase. */
export function createProviderFactories(
  options: Omit<DefaultProviderOptions, 'settings'>,
): ProviderFactories {
  return {
    aiText: { mock: () => new MockAITextProvider() },
    aiImage: { mock: () => new MockAIImageProvider() },
    payment: { mock: () => new MockPaymentProvider(options.mockWebhookSecret) },
    print: { mock: () => new MockPrintProvider(options.mockWebhookSecret) },
    email: { mock: () => new MockEmailProvider(options.onMockEmail) },
    storage: { local: () => new LocalStorageService(options.localStorage) },
  };
}

export function createProviderRegistry(options: DefaultProviderOptions): ProviderRegistry {
  return new ProviderRegistry(createProviderFactories(options), options.settings);
}
