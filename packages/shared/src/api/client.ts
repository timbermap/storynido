import type { z } from 'zod';

import {
  apiErrorSchema,
  apiRoutes,
  type ApiErrorCode,
  type ApiRouteName,
  type ApiRoutes,
} from './contract';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RouteOf<K extends ApiRouteName> = ApiRoutes[K];
type BodyOf<R> = R extends { body: infer B extends z.ZodType } ? z.input<B> : never;
type QueryOf<R> = R extends { query: infer Q extends z.ZodType } ? z.input<Q> : never;
type ResponseOf<R> = R extends { response: infer S extends z.ZodType } ? z.output<S> : never;

export interface CallInput<R> {
  body?: BodyOf<R>;
  query?: QueryOf<R>;
  params?: Record<string, string>;
  signal?: AbortSignal;
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Token de Firebase Auth del usuario (null si no hay sesión). */
  getIdToken?: () => Promise<string | null>;
  /** Token de App Check (null si no está configurado). */
  getAppCheckToken?: () => Promise<string | null>;
  fetch?: typeof fetch;
}

export type ApiClient = <K extends ApiRouteName>(
  name: K,
  input?: CallInput<RouteOf<K>>,
) => Promise<ResponseOf<RouteOf<K>>>;

function buildPath(template: string, params: Record<string, string> = {}): string {
  return template.replace(/:([A-Za-z]+)/g, (_, key: string) => {
    const value = params[key];
    if (value === undefined) throw new Error(`Falta el parámetro "${key}" para ${template}`);
    return encodeURIComponent(value);
  });
}

/** Cliente tipado: los nombres, cuerpos y respuestas salen del contrato y se validan con Zod. */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch = options.fetch ?? fetch;

  return async (name, input = {}) => {
    const route = apiRoutes[name];
    const url = new URL(buildPath(route.path, input.params), options.baseUrl);
    if (input.query) {
      for (const [key, value] of Object.entries(input.query)) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = { accept: 'application/json' };
    const token = route.access === 'public' ? null : await options.getIdToken?.();
    if (token) headers.authorization = `Bearer ${token}`;
    const appCheck = await options.getAppCheckToken?.();
    if (appCheck) headers['x-firebase-appcheck'] = appCheck;
    if (input.body !== undefined) headers['content-type'] = 'application/json';

    const res = await doFetch(url, {
      method: route.method,
      headers,
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
      signal: input.signal,
    });

    const payload: unknown = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
      const parsed = apiErrorSchema.safeParse(payload);
      if (parsed.success) {
        throw new ApiError(
          res.status,
          parsed.data.error.code,
          parsed.data.error.message,
          parsed.data.error.details,
        );
      }
      throw new ApiError(res.status, 'internal', `Error ${res.status} sin formato de la API`);
    }
    return route.response.parse(payload) as ResponseOf<RouteOf<typeof name>>;
  };
}
