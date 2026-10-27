import type { EmailMessage, StorageBucket } from '@storynido/shared';

import { GcsStorageService } from './gcp/storage';
import { VertexClient, VertexImageProvider, VertexTextProvider } from './gcp/vertex';
import { VisionPhotoAnalyzer } from './gcp/vision';

import { LocalStorageService } from './local/storage';
import { MockAIImageProvider, MockAITextProvider } from './mock/ai';
import { MockEmailProvider } from './mock/email';
import { MockPaymentProvider } from './mock/payment';
import { MockPhotoAnalyzer } from './mock/photo';
import { MockPrintProvider } from './mock/print';
import {
  ProviderRegistry,
  aiModelSettingsSchema,
  type AiModelSettings,
  type ProviderFactories,
  type ProviderSettings,
} from './registry';

export interface DefaultProviderOptions {
  settings: ProviderSettings;
  /** Secreto de firma de los webhooks simulados (solo local; no es una clave real). */
  mockWebhookSecret: string;
  localStorage: { rootDir: string; publicBaseUrl: string; secret: string };
  /** Buckets reales (solo con storage = gcs). */
  gcsBuckets?: Record<StorageBucket, string>;
  /** Proyecto de Google Cloud para Vertex AI (vacío en local: no se registra Vertex). */
  vertexProjectId?: string;
  /** Región de Vertex AI; "global" tiene los modelos más nuevos. */
  vertexLocation?: string;
  aiModels?: AiModelSettings;
  onMockEmail?: (message: EmailMessage) => void;
}

/** Implementaciones disponibles hoy. Las reales se suman acá en cada fase. */
export function createProviderFactories(
  options: Omit<DefaultProviderOptions, 'settings' | 'aiModels'>,
  currentModels: () => AiModelSettings = () => aiModelSettingsSchema.parse({}),
): ProviderFactories {
  const buckets = options.gcsBuckets;
  const projectId = options.vertexProjectId;
  let vertex: VertexClient | undefined;
  const vertexClient = (id: string) =>
    (vertex ??= new VertexClient({
      projectId: id,
      location: options.vertexLocation,
      models: currentModels,
    }));
  return {
    aiText: {
      mock: () => new MockAITextProvider(),
      ...(projectId ? { vertex: () => new VertexTextProvider(vertexClient(projectId)) } : {}),
    },
    aiImage: {
      mock: () => new MockAIImageProvider(),
      ...(projectId ? { vertex: () => new VertexImageProvider(vertexClient(projectId)) } : {}),
    },
    payment: { mock: () => new MockPaymentProvider(options.mockWebhookSecret) },
    print: {
      mock: () => new MockPrintProvider(options.mockWebhookSecret),
      // Más cara en impresión y más barata en envío a EE. UU.: gana según el destino.
      mock_alt: () =>
        new MockPrintProvider(options.mockWebhookSecret, {
          id: 'mock_alt',
          productionUsdMinor: { softcover: 1050, hardcover: 1550 },
          shippingUsdMinor: { US: 299 },
        }),
    },
    email: { mock: () => new MockEmailProvider(options.onMockEmail) },
    storage: {
      local: () => new LocalStorageService(options.localStorage),
      ...(buckets ? { gcs: () => new GcsStorageService(buckets) } : {}),
    },
    photoAnalyzer: {
      mock: () => new MockPhotoAnalyzer(),
      vision: () => new VisionPhotoAnalyzer(),
    },
  };
}

export function createProviderRegistry(options: DefaultProviderOptions): ProviderRegistry {
  // Los proveedores leen los modelos vigentes del registro (aiConfig los cambia en vivo).
  const defaults = options.aiModels ?? aiModelSettingsSchema.parse({});
  const registry: ProviderRegistry = new ProviderRegistry(
    createProviderFactories(options, () => registry.aiModels()),
    options.settings,
    defaults,
  );
  return registry;
}
