import {
  LULU_PRODUCTS,
  ProviderError,
  WebhookSignatureError,
  type Currency,
  type PrintAddress,
  type PrintEvent,
  type PrintFileSpec,
  type PrintItem,
  type PrintOrder,
  type PrintOrderRequest,
  type PrintProvider,
  type PrintQuote,
  type PrintStatus,
  type WebhookInput,
} from '@storynido/shared';
import { z } from 'zod';

const API = { production: 'https://api.lulu.com', sandbox: 'https://api.sandbox.lulu.com' };

/** US Letter al corte, en mm, y el sangrado de Lulu (1/8 de pulgada). */
const TRIM = { widthMm: 215.9, heightMm: 279.4 } as const;
const BLEED_MM = 3.175;

/** Páginas interiores mínimas por formato (tapa blanda: 32 a 800; tapa dura: desde 24). */
export const LULU_MIN_PAGES: Record<PrintItem['format'], number> = { softcover: 32, hardcover: 24 };

/** Niveles de envío que se cotizan (Lulu no tiene GROUND a EE. UU. para estos libros). */
const SHIPPING_LEVELS = ['MAIL', 'PRIORITY_MAIL'] as const;

/** Plazo estimado (producción + envío) por nivel: Lulu no lo informa en la cotización. */
const ETA_DAYS: Record<(typeof SHIPPING_LEVELS)[number], [number, number]> = {
  MAIL: [8, 16],
  PRIORITY_MAIL: [6, 10],
};

/** Estado de Lulu → estado de imprenta (los previos a la producción se ignoran). */
const STATUS: Partial<Record<string, PrintStatus>> = {
  IN_PRODUCTION: 'in_production',
  SHIPPED: 'shipped',
  REJECTED: 'failed',
  CANCELED: 'cancelled',
};

const money = z.coerce.number();

const costSchema = z.object({
  total_cost_incl_tax: money,
  shipping_cost: z.object({ total_cost_excl_tax: money }),
});

const jobSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    external_id: z.string().nullish(),
    status: z.object({ name: z.string() }),
    line_items: z
      .array(
        z
          .object({
            tracking_id: z.string().nullish(),
            tracking_urls: z.array(z.string()).nullish(),
          })
          .loose(),
      )
      .default([]),
  })
  .loose();

const listSchema = z.object({ results: z.array(jobSchema) });

const coverSchema = z.object({ width: money, height: money });

export interface LuluOptions {
  clientKey: string;
  clientSecret: string;
  /** Sandbox: no imprime ni cobra. Staging lo usa siempre. */
  sandbox: boolean;
  fetchImpl?: typeof fetch;
}

/** Páginas que se mandan a Lulu: el mínimo del formato y siempre pares. */
export function luluPageCount(format: PrintItem['format'], pages: number): number {
  const padded = Math.max(pages, LULU_MIN_PAGES[format]);
  return padded % 2 === 0 ? padded : padded + 1;
}

/**
 * Lulu: la más barata para EE. UU. Pide tapa y tripa por separado (las descarga de una URL) y
 * un mínimo de páginas que se completa al maquetar. Los avisos de estado no se creen: se
 * consulta el trabajo con nuestras credenciales.
 */
export class LuluPrintProvider implements PrintProvider {
  readonly id = 'lulu';
  private readonly fetchImpl: typeof fetch;
  private readonly base: string;
  private token: { value: string; expiresAt: number } | null = null;
  private readonly covers = new Map<string, Promise<z.infer<typeof coverSchema>>>();

  constructor(private readonly options: LuluOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.base = options.sandbox ? API.sandbox : API.production;
  }

  private async send(url: string, init: RequestInit) {
    try {
      return await this.fetchImpl(url, { ...init, signal: AbortSignal.timeout(20_000) });
    } catch (error) {
      throw new ProviderError(this.id, 'Sin respuesta de Lulu', true, { cause: error });
    }
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
    const basic = Buffer.from(`${this.options.clientKey}:${this.options.clientSecret}`).toString(
      'base64',
    );
    const response = await this.send(
      `${this.base}/auth/realms/glasstree/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${basic}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      },
    );
    if (!response.ok) {
      throw new ProviderError(this.id, `Credenciales rechazadas (HTTP ${String(response.status)})`);
    }
    const data = z
      .object({ access_token: z.string(), expires_in: z.number() })
      .parse(await response.json());
    // Se renueva un minuto antes de que venza.
    this.token = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };
    return data.access_token;
  }

  private async call(path: string, init: { method?: string; body?: unknown } = {}) {
    const response = await this.send(`${this.base}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        authorization: `Bearer ${await this.accessToken()}`,
        'content-type': 'application/json',
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await response.text();
    if (!response.ok) {
      // 4xx: Lulu no lo acepta (destino, páginas o archivos); 5xx y 429: se reintenta.
      const retryable = response.status >= 500 || response.status === 429;
      throw Object.assign(
        new ProviderError(
          this.id,
          `HTTP ${String(response.status)}: ${text.slice(0, 200)}`,
          retryable,
        ),
        { status: response.status },
      );
    }
    return text ? (JSON.parse(text) as unknown) : {};
  }

  private lineItems(items: readonly PrintItem[]) {
    return items.map((item) => ({
      page_count: luluPageCount(item.format, item.pageCount),
      pod_package_id: LULU_PRODUCTS[item.format],
      quantity: item.quantity,
    }));
  }

  private address(address: PrintAddress, email?: string) {
    return {
      name: address.name,
      street1: address.line1,
      ...(address.line2 ? { street2: address.line2 } : {}),
      city: address.city,
      ...(address.state ? { state_code: address.state } : {}),
      country_code: address.country,
      postcode: address.postalCode,
      // Lulu exige teléfono (la empresa de envíos lo usa para coordinar la entrega).
      phone_number: address.phone ?? '',
      ...(email ? { email } : {}),
    };
  }

  /** El envío más barato que acepta el destino (los niveles que no existen se descartan). */
  private async cheapest(items: readonly PrintItem[], address: PrintAddress) {
    const attempts = await Promise.allSettled(
      SHIPPING_LEVELS.map(async (level) => ({
        level,
        cost: costSchema.parse(
          await this.call('/print-job-cost-calculations/', {
            method: 'POST',
            body: {
              line_items: this.lineItems(items),
              shipping_address: this.address(address),
              shipping_option: level,
            },
          }),
        ),
      })),
    );
    const quotes = attempts.flatMap((attempt) =>
      attempt.status === 'fulfilled' ? [attempt.value] : [],
    );
    const best = quotes.sort((a, b) => a.cost.total_cost_incl_tax - b.cost.total_cost_incl_tax)[0];
    if (!best) {
      const failure = attempts.find(
        (attempt): attempt is PromiseRejectedResult => attempt.status === 'rejected',
      );
      if (failure?.reason instanceof ProviderError) throw failure.reason;
      throw new ProviderError(this.id, 'No envía a ese destino');
    }
    return best;
  }

  async quote(
    items: readonly PrintItem[],
    address: PrintAddress,
    currency: Currency,
  ): Promise<PrintQuote> {
    const { level, cost } = await this.cheapest(items, address);
    const minor = (value: number) => Math.round(value * 100);
    const shipping = cost.shipping_cost.total_cost_excl_tax;
    const [etaDaysMin, etaDaysMax] = ETA_DAYS[level];
    return {
      currency,
      shippingMinor: minor(shipping),
      // El impuesto de venta que cobra Lulu va con la producción: es costo nuestro.
      productionCostUsdMinor: minor(cost.total_cost_incl_tax - shipping),
      totalCostUsdMinor: minor(cost.total_cost_incl_tax),
      etaDaysMin,
      etaDaysMax,
    };
  }

  private async findJob(orderId: string) {
    const list = listSchema.parse(
      await this.call(`/print-jobs/?external_id=${encodeURIComponent(orderId)}`),
    );
    return list.results.find((job) => job.external_id === orderId) ?? null;
  }

  async createOrder(request: PrintOrderRequest): Promise<PrintOrder> {
    // Idempotente: nuestra referencia es el external_id; si ya existe (reintento), se devuelve.
    const existing = await this.findJob(request.orderId);
    if (existing) return { externalOrderId: String(existing.id), status: 'received' };
    if (!request.address.phone) {
      throw new ProviderError(this.id, 'Lulu necesita un teléfono de contacto para el envío');
    }
    const { level } = await this.cheapest(request.items, request.address);
    const job = jobSchema.parse(
      await this.call('/print-jobs/', {
        method: 'POST',
        body: {
          contact_email: request.email,
          external_id: request.orderId,
          shipping_level: level,
          shipping_address: this.address(request.address, request.email),
          line_items: request.items.map((item, index) => {
            if (!item.interiorPdfUrl || !item.coverPdfUrl) {
              throw new ProviderError(this.id, 'Lulu necesita tapa y tripa por separado');
            }
            return {
              external_id: `${request.orderId}-${String(index)}`,
              title: `StoryNido ${request.orderId}`,
              quantity: item.quantity,
              printable_normalization: {
                pod_package_id: LULU_PRODUCTS[item.format],
                cover: { source_url: item.coverPdfUrl },
                interior: { source_url: item.interiorPdfUrl },
              },
            };
          }),
        },
      }),
    );
    return { externalOrderId: String(job.id), status: 'received' };
  }

  async cancelOrder(externalOrderId: string) {
    try {
      await this.call(`/print-jobs/${encodeURIComponent(externalOrderId)}/status/`, {
        method: 'PUT',
        body: { name: 'CANCELED' },
      });
      return { cancelled: true, reason: null };
    } catch (error) {
      if (error instanceof ProviderError && !error.retryable) {
        return { cancelled: false, reason: 'Lulu ya no permite cancelarlo' };
      }
      throw error;
    }
  }

  async parseWebhook(input: WebhookInput): Promise<PrintEvent> {
    const payload = z
      .object({
        topic: z.string(),
        data: z.object({ id: z.union([z.number(), z.string()]) }).loose(),
      })
      .safeParse(JSON.parse(input.rawBody));
    if (!payload.success) throw new WebhookSignatureError(this.id, 'Aviso de Lulu inválido');
    const { topic, data } = payload.data;
    if (topic !== 'PRINT_JOB_STATUS_CHANGED') {
      return { type: 'ignored', eventId: `${topic}:${String(data.id)}`, rawType: topic };
    }
    // Lo que manda el aviso no se cree: se consulta el trabajo con nuestras credenciales.
    let job: z.infer<typeof jobSchema>;
    try {
      job = jobSchema.parse(await this.call(`/print-jobs/${encodeURIComponent(String(data.id))}/`));
    } catch (error) {
      if (error instanceof ProviderError && error.retryable) throw error;
      throw new WebhookSignatureError(this.id, 'El trabajo del aviso no existe en Lulu');
    }
    const status = STATUS[job.status.name];
    const tracking = job.line_items.find((item) => item.tracking_id) ?? null;
    if (!status || !job.external_id) {
      return {
        type: 'ignored',
        eventId: `${String(job.id)}:${job.status.name}`,
        rawType: `${topic}:${job.status.name}`,
      };
    }
    return {
      type: 'status',
      eventId: `${String(job.id)}:${status}:${tracking?.tracking_id ?? ''}`,
      orderId: job.external_id,
      externalOrderId: String(job.id),
      status,
      trackingNumber: tracking?.tracking_id ?? null,
      trackingUrl: tracking?.tracking_urls?.[0] ?? null,
    };
  }

  /** US Letter con sangrado de 1/8", el mínimo de páginas y la tapa que calcula Lulu. */
  async fileSpec(item: PrintItem): Promise<PrintFileSpec> {
    const pages = luluPageCount(item.format, item.pageCount);
    const key = `${item.format}:${String(pages)}`;
    let dimensions = this.covers.get(key);
    if (!dimensions) {
      dimensions = this.call('/cover-dimensions/', {
        method: 'POST',
        body: {
          pod_package_id: LULU_PRODUCTS[item.format],
          interior_page_count: pages,
          unit: 'mm',
        },
      }).then((data) => coverSchema.parse(data));
      this.covers.set(key, dimensions);
      dimensions.catch(() => this.covers.delete(key));
    }
    const { width, height } = await dimensions;
    // Sangrado (tapa blanda) o vuelta (tapa dura): lo que sobra alrededor del corte.
    const edge = (height - TRIM.heightMm) / 2;
    const spine = width - 2 * (TRIM.widthMm + edge);
    const round = (value: number) => Math.round(value * 100) / 100;
    return {
      packaging: 'separate',
      trim: TRIM,
      bleedMm: BLEED_MM,
      minInteriorPages: pages,
      cover: {
        widthMm: round(width),
        heightMm: round(height),
        spineLeftMm: round(edge + TRIM.widthMm),
        spineWidthMm: round(spine),
        edgeMm: round(edge),
      },
    };
  }
}

export interface LuluEnv {
  APP_ENV?: string;
  LULU_SANDBOX?: string;
  LULU_CLIENT_KEY?: string;
  LULU_CLIENT_SECRET?: string;
  LULU_SANDBOX_CLIENT_KEY?: string;
  LULU_SANDBOX_CLIENT_SECRET?: string;
}

/**
 * Lulu desde las variables de entorno. Fuera de producción va siempre al sandbox (no imprime
 * ni cobra), con sus propias claves si están; las de producción nunca crean pedidos fuera de
 * producción.
 */
export function luluOptionsFromEnv(env: LuluEnv): Omit<LuluOptions, 'fetchImpl'> | undefined {
  const sandbox =
    env.LULU_SANDBOX !== undefined ? env.LULU_SANDBOX === 'true' : env.APP_ENV !== 'production';
  const clientKey = sandbox
    ? (env.LULU_SANDBOX_CLIENT_KEY ?? env.LULU_CLIENT_KEY)
    : env.LULU_CLIENT_KEY;
  const clientSecret = sandbox
    ? (env.LULU_SANDBOX_CLIENT_SECRET ?? env.LULU_CLIENT_SECRET)
    : env.LULU_CLIENT_SECRET;
  return clientKey && clientSecret ? { clientKey, clientSecret, sandbox } : undefined;
}
