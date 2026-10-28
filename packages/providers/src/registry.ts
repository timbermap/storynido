import {
  ProviderUnavailableError,
  type AIImageProvider,
  type AIProvider,
  type AITextProvider,
  type EmailProvider,
  type PaymentProvider,
  type PhotoAnalyzer,
  type PrintProvider,
  type StorageService,
} from '@storynido/shared';
import { z } from 'zod';

/** IDs que el proyecto contempla; cada fase registra la implementación real que agrega. */
export const PROVIDER_IDS = {
  aiText: ['mock', 'vertex', 'anthropic'],
  aiImage: ['mock', 'vertex', 'flux'],
  payment: ['mock', 'stripe'],
  // mock_alt: segunda imprenta simulada (otros precios) para probar la elección entre varias.
  print: ['mock', 'mock_alt', 'gelato', 'cloudprinter', 'lulu'],
  email: ['mock', 'resend'],
  storage: ['local', 'gcs'],
  photoAnalyzer: ['mock', 'vision'],
} as const;

export type ProviderKind = keyof typeof PROVIDER_IDS;

export const providerSettingsSchema = z.object({
  aiText: z.enum(PROVIDER_IDS.aiText).default('mock'),
  aiImage: z.enum(PROVIDER_IDS.aiImage).default('mock'),
  payment: z.enum(PROVIDER_IDS.payment).default('mock'),
  /** Varias imprentas a la vez: se cotiza con todas y gana la más barata. */
  print: z
    .array(z.enum(PROVIDER_IDS.print))
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length, 'Imprenta repetida')
    .default(['mock']),
  email: z.enum(PROVIDER_IDS.email).default('mock'),
  storage: z.enum(PROVIDER_IDS.storage).default('local'),
  photoAnalyzer: z.enum(PROVIDER_IDS.photoAnalyzer).default('mock'),
});

/** Modelos por defecto de IA (aiConfig.textModel / imageModel los pisan en vivo). */
export const aiModelSettingsSchema = z.object({
  text: z.string().min(1).default('gemini-3.5-flash'),
  image: z.string().min(1).default('gemini-3.1-flash-image'),
});

export type AiModelSettings = z.infer<typeof aiModelSettingsSchema>;

export function aiModelSettingsFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): AiModelSettings {
  const value = (key: string) => (env[key] === '' ? undefined : env[key]);
  return aiModelSettingsSchema.parse({
    text: value('AI_TEXT_MODEL'),
    image: value('AI_IMAGE_MODEL'),
  });
}

export type ProviderSettings = z.infer<typeof providerSettingsSchema>;

const SIMULATED = new Set(['mock', 'mock_alt', 'local']);

/** Proveedores simulados configurados (producción no puede usar ninguno). */
export function simulatedProviders(settings: ProviderSettings): string[] {
  return Object.values(settings)
    .flat()
    .filter((id) => SIMULATED.has(id));
}

/** Configuración inicial desde variables de entorno (ver .env.example). */
export function providerSettingsFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): ProviderSettings {
  const value = (key: string) => (env[key] === '' ? undefined : env[key]);
  return providerSettingsSchema.parse({
    aiText: value('AI_TEXT_PROVIDER'),
    aiImage: value('AI_IMAGE_PROVIDER'),
    payment: value('PAYMENT_PROVIDER'),
    // PRINT_PROVIDERS=mock,gelato (lista); PRINT_PROVIDER se acepta por compatibilidad.
    print: (value('PRINT_PROVIDERS') ?? value('PRINT_PROVIDER'))
      ?.split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    email: value('EMAIL_PROVIDER'),
    storage: value('STORAGE_PROVIDER'),
    photoAnalyzer: value('PHOTO_ANALYZER'),
  });
}

interface ProviderTypes {
  aiText: AITextProvider;
  aiImage: AIImageProvider;
  payment: PaymentProvider;
  print: PrintProvider;
  email: EmailProvider;
  storage: StorageService;
  photoAnalyzer: PhotoAnalyzer;
}

export type ProviderFactories = {
  [K in ProviderKind]: Partial<Record<(typeof PROVIDER_IDS)[K][number], () => ProviderTypes[K]>>;
};

export interface AiOverride {
  text?: string;
  image?: string;
  /** Modelos (solo aplican a proveedores reales; los mocks los ignoran). */
  textModel?: string;
  imageModel?: string;
}

/**
 * Elige la implementación de cada proveedor en tiempo de ejecución.
 * La IA puede cambiarse sin redeploy con `setAiOverride` (lo alimenta aiConfig en Firestore).
 * Las instancias se crean una sola vez por ID.
 */
export class ProviderRegistry {
  private readonly instances = new Map<string, unknown>();
  private aiOverride: AiOverride = {};

  constructor(
    private readonly factories: ProviderFactories,
    private readonly settings: ProviderSettings,
    private readonly defaultModels: AiModelSettings = aiModelSettingsSchema.parse({}),
  ) {
    // Falla al arrancar si la configuración pide algo que no existe.
    for (const kind of Object.keys(PROVIDER_IDS) as ProviderKind[]) {
      const ids = settings[kind];
      for (const id of Array.isArray(ids) ? ids : [ids]) this.factory(kind, id);
    }
  }

  private factory<K extends ProviderKind>(kind: K, id: string): () => ProviderTypes[K] {
    const factory = (this.factories[kind] as Record<string, (() => ProviderTypes[K]) | undefined>)[
      id
    ];
    if (!factory) throw new ProviderUnavailableError(kind, id, this.available(kind));
    return factory;
  }

  private resolve<K extends ProviderKind>(kind: K, id: string): ProviderTypes[K] {
    const key = `${kind}:${id}`;
    if (!this.instances.has(key)) this.instances.set(key, this.factory(kind, id)());
    return this.instances.get(key) as ProviderTypes[K];
  }

  available(kind: ProviderKind): string[] {
    return Object.keys(this.factories[kind]);
  }

  /** Aplica la configuración de IA del admin. Rechaza proveedores no disponibles. */
  setAiOverride(override: AiOverride): void {
    if (override.text) this.factory('aiText', override.text);
    if (override.image) this.factory('aiImage', override.image);
    this.aiOverride = override;
  }

  /** Modelos de IA vigentes. */
  aiModels(): AiModelSettings {
    return {
      text: this.aiOverride.textModel ?? this.defaultModels.text,
      image: this.aiOverride.imageModel ?? this.defaultModels.image,
    };
  }

  active(): Record<ProviderKind, string> {
    return {
      ...this.settings,
      print: this.settings.print.join(','),
      aiText: this.aiOverride.text ?? this.settings.aiText,
      aiImage: this.aiOverride.image ?? this.settings.aiImage,
    };
  }

  ai(): AIProvider {
    const active = this.active();
    return {
      text: this.resolve('aiText', active.aiText),
      image: this.resolve('aiImage', active.aiImage),
    };
  }

  payment(): PaymentProvider {
    return this.resolve('payment', this.settings.payment);
  }

  /** Imprentas activas en este ambiente (en el orden configurado). */
  printers(): PrintProvider[] {
    return this.settings.print.map((id) => this.resolve('print', id));
  }

  /** Una imprenta activa por su ID (webhooks, pedidos ya ruteados). */
  printer(id: string): PrintProvider | null {
    return (this.settings.print as readonly string[]).includes(id)
      ? this.resolve('print', id)
      : null;
  }

  email(): EmailProvider {
    return this.resolve('email', this.settings.email);
  }

  storage(): StorageService {
    return this.resolve('storage', this.settings.storage);
  }

  photoAnalyzer(): PhotoAnalyzer {
    return this.resolve('photoAnalyzer', this.settings.photoAnalyzer);
  }

  describe(): { active: Record<ProviderKind, string>; available: Record<ProviderKind, string[]> } {
    const kinds = Object.keys(PROVIDER_IDS) as ProviderKind[];
    return {
      active: this.active(),
      available: Object.fromEntries(kinds.map((kind) => [kind, this.available(kind)])) as Record<
        ProviderKind,
        string[]
      >,
    };
  }
}
