import type { EmailMessage, StorageBucket } from '@storynido/shared';

import { GcsStorageService } from './gcp/storage';
import {
  VertexClient,
  VertexImageProvider,
  VertexTextProvider,
  type ModelPriceLookup,
} from './gcp/vertex';
import { VisionPhotoAnalyzer } from './gcp/vision';
import { CloudprinterPrintProvider, type CloudprinterOptions } from './cloudprinter/print';
import { GelatoPrintProvider, type GelatoOptions } from './gelato/print';
import { LuluPrintProvider, type LuluOptions } from './lulu/print';
import { ResendEmailProvider, type ResendOptions } from './resend/email';

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
  /** Gelato (solo si hay clave): sin clave, la imprenta no se registra. */
  gelato?: Pick<GelatoOptions, 'apiKey' | 'orderType'>;
  /** Cloudprinter (solo si hay clave). */
  cloudprinter?: Omit<CloudprinterOptions, 'fetchImpl'>;
  /** Lulu (solo si hay clave; fuera de producción, el sandbox). */
  lulu?: Omit<LuluOptions, 'fetchImpl'>;
  /** Resend (solo si hay clave): sin clave, los mails quedan en el proveedor simulado. */
  resend?: Omit<ResendOptions, 'fetchImpl'>;
  onMockEmail?: (message: EmailMessage) => void;
}

/** Implementaciones disponibles hoy. Las reales se suman acá en cada fase. */
export function createProviderFactories(
  options: Omit<DefaultProviderOptions, 'settings' | 'aiModels'>,
  currentModels: () => AiModelSettings = () => aiModelSettingsSchema.parse({}),
  currentPrices?: ModelPriceLookup,
): ProviderFactories {
  const buckets = options.gcsBuckets;
  const gelato = options.gelato;
  const cloudprinter = options.cloudprinter;
  const lulu = options.lulu;
  const resend = options.resend;
  const projectId = options.vertexProjectId;
  let vertex: VertexClient | undefined;
  const vertexClient = (id: string) =>
    (vertex ??= new VertexClient({
      projectId: id,
      location: options.vertexLocation,
      models: currentModels,
      prices: currentPrices,
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
          productionUsdMinor: { softcover: 1050, hardcover: 1550, booklet: 800 },
          shippingUsdMinor: { US: 299 },
        }),
      ...(gelato ? { gelato: () => new GelatoPrintProvider(gelato) } : {}),
      ...(cloudprinter ? { cloudprinter: () => new CloudprinterPrintProvider(cloudprinter) } : {}),
      ...(lulu ? { lulu: () => new LuluPrintProvider(lulu) } : {}),
    },
    email: {
      mock: () => new MockEmailProvider(options.onMockEmail),
      ...(resend ? { resend: () => new ResendEmailProvider(resend) } : {}),
    },
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
    createProviderFactories(
      options,
      () => registry.aiModels(),
      (model) => registry.modelPrice(model),
    ),
    options.settings,
    defaults,
  );
  return registry;
}
