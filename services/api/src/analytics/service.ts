import { GoogleAuth } from 'google-auth-library';

/** Las visitas medidas por Google Analytics 4 (solo de quienes aceptaron la analítica). */
export interface AnalyticsRow {
  key: string;
  users: number;
  sessions: number;
  purchases: number;
}

export interface AnalyticsReport {
  connected: boolean;
  /** Por qué no hay números (falta la propiedad o Google rechazó la lectura). */
  message: string | null;
  days: number;
  totals: {
    users: number;
    sessions: number;
    views: number;
    purchases: number;
    revenue: number;
  };
  daily: { day: string; users: number; sessions: number }[];
  sources: AnalyticsRow[];
  countries: { key: string; users: number }[];
  pages: { key: string; views: number }[];
  events: { key: string; count: number }[];
}

/** Una consulta a la API de datos de GA4 (`runReport`); inyectable para probar sin red. */
export type RunReport = (request: Record<string, unknown>) => Promise<GaReportResponse>;

export interface GaReportResponse {
  rows?: {
    dimensionValues?: { value?: string }[];
    metricValues?: { value?: string }[];
  }[];
}

export const FUNNEL_EVENTS = ['create_started', 'preview_created', 'begin_checkout', 'purchase'];

const empty = (days: number, connected: boolean, message: string | null): AnalyticsReport => ({
  connected,
  message,
  days,
  totals: { users: 0, sessions: 0, views: 0, purchases: 0, revenue: 0 },
  daily: [],
  sources: [],
  countries: [],
  pages: [],
  events: [],
});

const n = (value: string | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const day = (yyyymmdd: string | undefined) =>
  yyyymmdd?.length === 8
    ? `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
    : (yyyymmdd ?? '');

/** runReport real: la cuenta de servicio de la API (ADC) tiene que ser lectora de la propiedad. */
export function gaRunReport(propertyId: string): RunReport {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/analytics.readonly'] });
  return async (request) => {
    const client = await auth.getClient();
    const response = await client.request<GaReportResponse>({
      url: `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      method: 'POST',
      data: request,
      timeout: 15_000,
    });
    return response.data;
  };
}

/**
 * Lee Google Analytics 4 por demanda para el admin (con una memoria corta para no repetir
 * consultas). Solo lectura. Sin propiedad configurada, el panel muestra cómo conectarla.
 */
export class AnalyticsService {
  private readonly cache = new Map<number, { at: number; report: AnalyticsReport }>();

  constructor(
    private readonly run: RunReport | null,
    private readonly now: () => number = () => Date.now(),
    private readonly ttlMs = 10 * 60 * 1000,
  ) {}

  async report(days: number): Promise<AnalyticsReport> {
    if (!this.run) {
      return empty(
        days,
        false,
        'Falta cargar el ID de la propiedad de Analytics (GA4_PROPERTY_ID).',
      );
    }
    const hit = this.cache.get(days);
    if (hit && this.now() - hit.at < this.ttlMs) return hit.report;
    try {
      const report = await this.read(this.run, days);
      this.cache.set(days, { at: this.now(), report });
      return report;
    } catch (caught) {
      const status = (caught as { response?: { status?: number } }).response?.status;
      const hint =
        status === 403
          ? ' La cuenta de servicio de la API no tiene acceso de Lector a la propiedad, o falta activar la API de datos de Analytics.'
          : '';
      return empty(
        days,
        false,
        `Analytics no respondió${status ? ` (error ${String(status)})` : ''}.${hint}`,
      );
    }
  }

  private async read(run: RunReport, days: number): Promise<AnalyticsReport> {
    const dateRanges = [{ startDate: `${String(days)}daysAgo`, endDate: 'today' }];
    const [totals, daily, sources, countries, pages, events] = await Promise.all([
      run({
        dateRanges,
        metrics: [
          'activeUsers',
          'sessions',
          'screenPageViews',
          'ecommercePurchases',
          'purchaseRevenue',
        ].map((name) => ({ name })),
      }),
      run({
        dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
      run({
        dateRanges,
        dimensions: [{ name: 'sessionSourceMedium' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'ecommercePurchases' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),
      run({
        dateRanges,
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 10,
      }),
      run({
        dateRanges,
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10,
      }),
      run({
        dateRanges,
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: { fieldName: 'eventName', inListFilter: { values: FUNNEL_EVENTS } },
        },
      }),
    ]);
    const total = totals.rows?.[0]?.metricValues ?? [];
    const eventCounts = new Map(
      (events.rows ?? []).map((row) => [
        row.dimensionValues?.[0]?.value ?? '',
        n(row.metricValues?.[0]?.value),
      ]),
    );
    return {
      connected: true,
      message: null,
      days,
      totals: {
        users: n(total[0]?.value),
        sessions: n(total[1]?.value),
        views: n(total[2]?.value),
        purchases: n(total[3]?.value),
        revenue: n(total[4]?.value),
      },
      daily: (daily.rows ?? []).map((row) => ({
        day: day(row.dimensionValues?.[0]?.value),
        users: n(row.metricValues?.[0]?.value),
        sessions: n(row.metricValues?.[1]?.value),
      })),
      sources: (sources.rows ?? []).map((row) => ({
        key: row.dimensionValues?.[0]?.value ?? '(not set)',
        users: n(row.metricValues?.[0]?.value),
        sessions: n(row.metricValues?.[1]?.value),
        purchases: n(row.metricValues?.[2]?.value),
      })),
      countries: (countries.rows ?? []).map((row) => ({
        key: row.dimensionValues?.[0]?.value ?? '(not set)',
        users: n(row.metricValues?.[0]?.value),
      })),
      pages: (pages.rows ?? []).map((row) => ({
        key: row.dimensionValues?.[0]?.value ?? '',
        views: n(row.metricValues?.[0]?.value),
      })),
      events: FUNNEL_EVENTS.map((key) => ({ key, count: eventCounts.get(key) ?? 0 })),
    };
  }
}
