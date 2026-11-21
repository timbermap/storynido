'use client';

import { useCallback, useMemo, useState } from 'react';

import { Card, Notice, PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';

const RANGES = [7, 30, 90] as const;
const nf = new Intl.NumberFormat('es');
const pct = (part: number, whole: number) =>
  whole > 0
    ? `${((part / whole) * 100).toLocaleString('es', { maximumFractionDigits: 1 })} %`
    : '—';

const NETWORK_LABELS: Record<string, string> = {
  direct: 'Directo / sin origen',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X (Twitter)',
  pinterest: 'Pinterest',
  linkedin: 'LinkedIn',
  telegram: 'Telegram',
  reddit: 'Reddit',
  google: 'Google',
  bing: 'Bing',
  duckduckgo: 'DuckDuckGo',
  email: 'Email',
  unknown: 'Sin origen (no aceptó cookies)',
};
const sourceLabel = (key: string) =>
  NETWORK_LABELS[key] ?? (key.startsWith('ref:') ? key.slice(4) : key);

const DEVICE_LABELS: Record<string, string> = {
  mobile: 'Celular',
  tablet: 'Tableta',
  desktop: 'Computadora',
};
const LOCALE_LABELS: Record<string, string> = { es: 'Español', en: 'English', pt: 'Português' };

const regionNames = new Intl.DisplayNames(['es'], { type: 'region' });
const countryLabel = (code: string) => {
  if (code === 'ZZ') return 'Sin detectar';
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
};

/** Campaña «red/medio/nombre» legible. */
const campaignLabel = (key: string) => {
  const [source = '', medium = '', ...name] = key.split('/');
  return `${name.join('/')} · ${sourceLabel(source)}${medium && medium !== '-' ? ` / ${medium}` : ''}`;
};

/** «red/pieza» legible. */
const detailLabel = (key: string) => {
  const [source = '', ...name] = key.split('/');
  return `${name.join('/')} · ${sourceLabel(source)}`;
};

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

interface Row {
  key: string;
  views: number;
  entries: number;
}

/** Tabla con barra de proporción: la primera columna numérica es la que se compara. */
function BarTable({
  title,
  note,
  rows,
  label,
  valueName,
  secondName,
  pick = 'views',
}: {
  title: string;
  note?: string;
  rows: Row[];
  label: (key: string) => string;
  valueName: string;
  secondName?: string;
  pick?: 'views' | 'entries';
}) {
  const max = Math.max(1, ...rows.map((row) => row[pick]));
  const total = rows.reduce((sum, row) => sum + row[pick], 0);
  return (
    <Card>
      <h2 className="font-semibold">{title}</h2>
      {note && <p className="mb-2 text-xs text-muted-foreground">{note}</p>}
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Todavía no hay datos en este período.</p>
      ) : (
        <table className="mt-2 w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-1 font-normal">&nbsp;</th>
              <th className="pb-1 text-right font-normal">{valueName}</th>
              {secondName && <th className="pb-1 pl-3 text-right font-normal">{secondName}</th>}
              <th className="pb-1 pl-3 text-right font-normal">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t align-middle">
                <td className="max-w-[16rem] py-1.5 pr-2">
                  <div className="truncate" title={label(row.key)}>
                    {label(row.key)}
                  </div>
                  <div className="mt-0.5 h-1.5 rounded-full bg-accent">
                    <div
                      className="bg-chart-1 h-1.5 rounded-full"
                      style={{ width: `${String((row[pick] / max) * 100)}%` }}
                    />
                  </div>
                </td>
                <td className="py-1.5 text-right font-semibold">{nf.format(row[pick])}</td>
                {secondName && (
                  <td className="py-1.5 pl-3 text-right text-muted-foreground">
                    {nf.format(pick === 'views' ? row.entries : row.views)}
                  </td>
                )}
                <td className="py-1.5 pl-3 text-right text-muted-foreground">
                  {pct(row[pick], total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

interface FunnelRow {
  key: string;
  entries: number;
  create_started: number;
  preview_created: number;
  begin_checkout: number;
  purchase: number;
}

function FunnelTable({
  title,
  note,
  rows,
  label,
}: {
  title: string;
  note: string;
  rows: FunnelRow[];
  label: (key: string) => string;
}) {
  return (
    <Card>
      <h2 className="font-semibold">{title}</h2>
      <p className="mb-2 text-xs text-muted-foreground">{note}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay datos en este período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm tabular-nums">
            <thead>
              <tr className="text-right text-xs text-muted-foreground">
                <th className="pb-1 text-left font-normal">&nbsp;</th>
                <th className="pb-1 font-normal">Entradas</th>
                <th className="pb-1 font-normal">Empezaron</th>
                <th className="pb-1 font-normal">Muestra</th>
                <th className="pb-1 font-normal">Pago</th>
                <th className="pb-1 font-normal">Compras</th>
                <th className="pb-1 font-normal">Empezó→compra</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t text-right">
                  <td className="max-w-[16rem] truncate py-1.5 pr-2 text-left">{label(row.key)}</td>
                  <td className="py-1.5">{nf.format(row.entries)}</td>
                  <td className="py-1.5">{nf.format(row.create_started)}</td>
                  <td className="py-1.5">{nf.format(row.preview_created)}</td>
                  <td className="py-1.5">{nf.format(row.begin_checkout)}</td>
                  <td className="py-1.5 font-semibold">{nf.format(row.purchase)}</td>
                  <td className="py-1.5 text-muted-foreground">
                    {pct(row.purchase, row.create_started)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Barras por día: visitas (fuerte) y entradas (suave), con el valor al pasar el mouse. */
function DailyViews({ daily }: { daily: { day: string; views: number; entries: number }[] }) {
  const max = Math.max(1, ...daily.map((day) => day.views));
  return (
    <div
      className="flex h-36 items-end gap-px"
      role="img"
      aria-label={`Visitas por día, máximo ${String(max)}`}
    >
      {daily.map((day) => (
        <div
          key={day.day}
          className="group relative flex h-full flex-1 flex-col justify-end"
          title={`${day.day}: ${String(day.views)} visitas, ${String(day.entries)} entradas`}
        >
          <div
            className="bg-chart-1 rounded-t-sm"
            style={{ height: `${String((day.views / max) * 100)}%`, minHeight: day.views ? 2 : 0 }}
          />
        </div>
      ))}
    </div>
  );
}

/** Armador de enlaces con UTM: para que cada publicación o anuncio se pueda medir. */
function UtmBuilder() {
  const [url, setUrl] = useState('https://staging.storynido.com/es');
  const [source, setSource] = useState('instagram');
  const [medium, setMedium] = useState('social');
  const [campaign, setCampaign] = useState('');
  const link = useMemo(() => {
    try {
      const target = new URL(url);
      target.searchParams.set('utm_source', source.trim().toLowerCase());
      target.searchParams.set('utm_medium', medium.trim().toLowerCase());
      if (campaign.trim()) {
        target.searchParams.set(
          'utm_campaign',
          campaign
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-'),
        );
      }
      return target.toString();
    } catch {
      return '';
    }
  }, [url, source, medium, campaign]);
  const field = 'h-8 w-full rounded-md border bg-background px-2 text-sm';
  return (
    <Card>
      <h2 className="font-semibold">Armar un enlace medible</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Usá un enlace distinto en cada publicación, anuncio, bio o mensaje. WhatsApp e Instagram a
        veces no avisan de dónde vino la persona: sin UTM caen en «Directo».
      </p>
      <div className="grid gap-2 md:grid-cols-4">
        <label className="text-xs md:col-span-4">
          Página
          <input
            className={field}
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
            }}
          />
        </label>
        <label className="text-xs">
          Red o fuente
          <input
            className={field}
            list="utm-sources"
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
            }}
          />
          <datalist id="utm-sources">
            {['instagram', 'whatsapp', 'tiktok', 'facebook', 'youtube', 'email', 'x'].map(
              (name) => (
                <option key={name} value={name} />
              ),
            )}
          </datalist>
        </label>
        <label className="text-xs">
          Medio
          <input
            className={field}
            list="utm-media"
            value={medium}
            onChange={(event) => {
              setMedium(event.target.value);
            }}
          />
          <datalist id="utm-media">
            {['social', 'bio', 'story', 'reel', 'cpc', 'email', 'qr', 'referral'].map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        <label className="text-xs md:col-span-2">
          Campaña
          <input
            className={field}
            placeholder="ej: invitaciones-cumple"
            value={campaign}
            onChange={(event) => {
              setCampaign(event.target.value);
            }}
          />
        </label>
      </div>
      {link && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 rounded-md bg-accent px-2 py-1 text-xs break-all">
            {link}
          </code>
          <button
            type="button"
            className="h-8 rounded-md border px-3 text-sm"
            onClick={() => {
              void navigator.clipboard.writeText(link);
            }}
          >
            Copiar
          </button>
        </div>
      )}
    </Card>
  );
}

/** Visitas y campañas: contadores propios, sin cookies ni datos de las personas. */
export default function TrafficPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const load = useCallback(() => api('adminTraffic', { query: { days } }), [days]);
  const { data, error } = useApi(load);
  const funnelTotals = data?.funnelBySource.reduce(
    (sum, row) => ({
      create: sum.create + row.create_started,
      purchase: sum.purchase + row.purchase,
    }),
    { create: 0, purchase: 0 },
  );
  return (
    <>
      <PageHeader
        title="Visitas y campañas"
        text="Qué páginas públicas se ven, de dónde llega la gente y qué campañas y redes terminan en una muestra o una compra."
        actions={
          <div className="flex gap-1" role="group" aria-label="Período">
            {RANGES.map((range) => (
              <button
                key={range}
                type="button"
                aria-pressed={days === range}
                onClick={() => {
                  setDays(range);
                }}
                className="h-8 rounded-md border px-3 text-sm aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:font-semibold"
              >
                {range} días
              </button>
            ))}
          </div>
        }
      />
      {error && <Notice tone="error">{error}</Notice>}
      {data && (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Visitas a páginas" value={nf.format(data.totals.views)} />
            <Kpi
              label="Entradas"
              value={nf.format(data.totals.entries)}
              hint="Veces que alguien llegó al sitio (no cuenta los cambios de página)."
            />
            <Kpi
              label="Entradas con campaña"
              value={pct(data.totals.campaignEntries, data.totals.entries)}
              hint={`${nf.format(data.totals.campaignEntries)} traían UTM`}
            />
            <Kpi
              label="Empezaron → compraron"
              value={funnelTotals ? pct(funnelTotals.purchase, funnelTotals.create) : '—'}
              hint="Solo de quienes aceptaron la analítica."
            />
          </div>

          <Card>
            <h2 className="mb-2 font-semibold">Visitas por día</h2>
            <DailyViews daily={data.daily} />
            <p className="mt-1 text-xs text-muted-foreground">
              Desde {data.since}. Pasá el mouse por una barra para ver el día.
            </p>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <BarTable
              title="Fuentes y redes sociales"
              note="De dónde llegó cada entrada. «Directo» incluye WhatsApp, Instagram y apps que no avisan: medilas con enlaces UTM."
              rows={data.sources}
              label={sourceLabel}
              valueName="Entradas"
            />
            <BarTable
              title="Campañas (UTM)"
              note="Solo entradas con utm_campaign. Armá los enlaces abajo."
              rows={data.campaigns}
              label={campaignLabel}
              valueName="Entradas"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <BarTable
              title="Piezas (utm_content)"
              note="Qué publicación, pin o video trajo la visita: «red · pieza»."
              rows={data.contents}
              label={detailLabel}
              valueName="Entradas"
            />
            <BarTable
              title="Palabras (utm_term)"
              note="Palabra o público de la campaña, si el enlace lo trae."
              rows={data.terms}
              label={detailLabel}
              valueName="Entradas"
            />
          </div>

          <FunnelTable
            title="Embudo por fuente"
            note="Entradas de todos; los pasos siguientes cuentan solo a quienes aceptaron cookies de analítica, atribuidos a su fuente de los últimos 30 días."
            rows={data.funnelBySource}
            label={sourceLabel}
          />
          <FunnelTable
            title="Embudo por campaña"
            note="Qué campaña termina en una muestra, un pago y una compra."
            rows={data.funnelByCampaign}
            label={campaignLabel}
          />

          <BarTable
            title="Páginas más vistas"
            note="Vistas y, al lado, las veces que fue la página de entrada."
            rows={data.pages}
            label={(key) => key}
            valueName="Vistas"
            secondName="Como entrada"
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <BarTable
              title="País"
              note="Por la ubicación aproximada de la conexión; la IP no se guarda."
              rows={data.countries}
              label={countryLabel}
              valueName="Vistas"
            />
            <BarTable
              title="Dispositivo"
              rows={data.devices}
              label={(key) => DEVICE_LABELS[key] ?? key}
              valueName="Vistas"
            />
            <BarTable
              title="Idioma del sitio"
              rows={data.locales}
              label={(key) => LOCALE_LABELS[key] ?? key}
              valueName="Vistas"
            />
          </div>

          <UtmBuilder />

          <Notice>
            Cómo se mide: contadores propios sin cookies, sin IP y sin identificadores, solo en
            páginas públicas (nunca en el creador, la cuenta ni el pago). Respeta «No rastrear». No
            hay ciudad a propósito: con país alcanza y es más privado. Los pasos del embudo
            necesitan que la persona acepte la analítica; el resto de las personas cuenta en visitas
            y entradas.
          </Notice>
        </div>
      )}
    </>
  );
}
