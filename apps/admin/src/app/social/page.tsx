'use client';

import { SOCIAL_NETWORKS, type SocialNetwork } from '@storynido/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Card, Notice, PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { errorMessage, useApi } from '@/lib/use-api';

const RANGES = [7, 30, 90] as const;
const nf = new Intl.NumberFormat('es');
const num = (value: number | null) => (value === null ? '—' : nf.format(value));
const pct = (part: number, whole: number) =>
  whole > 0
    ? `${((part / whole) * 100).toLocaleString('es', { maximumFractionDigits: 1 })} %`
    : '—';

const LABELS: Record<SocialNetwork, string> = {
  pinterest: 'Pinterest',
  instagram: 'Instagram',
  tiktok: 'TikTok',
};
const PROFILE_URL: Record<SocialNetwork, (handle: string) => string> = {
  pinterest: (handle) => `https://www.pinterest.com/${handle}/`,
  instagram: (handle) => `https://www.instagram.com/${handle}/`,
  tiktok: (handle) => `https://www.tiktok.com/@${handle}`,
};

/** Qué tiene que hacer Sebas para conectar cada red (las claves van a Secret Manager). */
const SETUP: Record<SocialNetwork, string[]> = {
  pinterest: [
    'Cuenta de Pinterest en modo empresa (ya es @storynido).',
    'Crear una app en developers.pinterest.com y pedir acceso (Trial alcanza para leer).',
    'Con los permisos user_accounts:read y pins:read, generar el token de renovación y guardar app id, app secret y refresh token.',
  ],
  instagram: [
    'Pasar @storynido.redes a cuenta profesional (Creador o Empresa).',
    'Vincularla a una página de Facebook de StoryNido.',
    'Crear una app de Meta con permisos instagram_basic y instagram_manage_insights, y generar un token de usuario del sistema (no vence) con el ID de la cuenta.',
  ],
  tiktok: [
    'Registrar una app en developers.tiktok.com con Login Kit y los permisos user.info.stats y video.list.',
    'Guardar client key y client secret de la app en Secret Manager y sumar «tiktok» a social_networks.',
    'Registrar https://admin.storynido.com/social como redirect URI y tocar «Conectar TikTok» arriba: se autoriza la cuenta @storynido.redes una vez y el token se guarda solo.',
  ],
};

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Bars({
  values,
  label,
}: {
  values: { day: string; value: number | null }[];
  label: string;
}) {
  const max = Math.max(1, ...values.map((row) => row.value ?? 0));
  if (values.every((row) => row.value === null)) return null;
  return (
    <div className="mt-3">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <div className="flex h-16 items-end gap-px" role="img" aria-label={label}>
        {values.map((row) => (
          <div
            key={row.day}
            className="bg-chart-1 flex-1 rounded-t-sm"
            title={`${row.day}: ${num(row.value)}`}
            style={{
              height: `${String(((row.value ?? 0) / max) * 100)}%`,
              minHeight: row.value ? 2 : 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

const TIKTOK_STATE_KEY = 'storynido.tiktokOauthState';

/** Dirección de vuelta que se registra en TikTok: la propia página, sin parámetros. */
const redirectUri = () => `${window.location.origin}/social`;

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca';

/** Marketing → Redes sociales: números leídos por las APIs de cada red, más las visitas que traen al sitio. */
export default function SocialPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(
    () =>
      Promise.all([
        api('adminSocial', { query: { days } }),
        api('adminTraffic', { query: { days } }),
      ]),
    [days],
  );
  const { data, error, reload } = useApi(load);
  const [social, traffic] = data ?? [];

  // Al volver de TikTok llegan ?code=…&state=…: se verifica el state y se guarda la conexión.
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const returned = params.get('state');
    const denied = params.get('error');
    if (!code && !denied) return;
    handled.current = true;
    const expected = window.sessionStorage.getItem(TIKTOK_STATE_KEY);
    window.sessionStorage.removeItem(TIKTOK_STATE_KEY);
    window.history.replaceState(null, '', '/social');
    void (async () => {
      if (denied) {
        setMessage('TikTok: la autorización se canceló. Podés intentar de nuevo.');
        return;
      }
      if (!code || !returned || returned !== expected) {
        setMessage(
          'TikTok: la respuesta no coincide con la que se pidió. Volvé a tocar «Conectar TikTok».',
        );
        return;
      }
      setSyncing(true);
      try {
        const { displayName } = await api('adminSocialTiktokConnect', {
          body: { code, redirectUri: redirectUri() },
        });
        await api('adminSocialSync', { body: { days: 30 } });
        setMessage(
          `TikTok conectado${displayName ? `: ${displayName}` : ''}. Ya se leyeron los números.`,
        );
        await reload();
      } catch (caught) {
        setMessage(errorMessage(caught));
      } finally {
        setSyncing(false);
      }
    })();
  }, [reload]);

  const connectTikTok = async (withVideos: boolean) => {
    setMessage(null);
    try {
      const state = crypto.randomUUID();
      window.sessionStorage.setItem(TIKTOK_STATE_KEY, state);
      const { url } = await api('adminSocialTiktokAuthUrl', {
        query: { redirectUri: redirectUri(), state, videos: withVideos ? '1' : '0' },
      });
      window.location.assign(url);
    } catch (caught) {
      setMessage(errorMessage(caught));
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const { results } = await api('adminSocialSync', { body: { days: 30 } });
      const failed = results.filter((row) => row.status === 'error');
      setMessage(
        failed.length
          ? failed.map((row) => row.message).join(' ')
          : 'Listo: se leyeron las redes conectadas.',
      );
      await reload();
    } catch (caught) {
      setMessage(errorMessage(caught));
    } finally {
      setSyncing(false);
    }
  };

  const visitsOf = (network: SocialNetwork) => {
    const entries = traffic?.sources.find((row) => row.key === network)?.entries ?? 0;
    const funnel = traffic?.funnelBySource.find((row) => row.key === network);
    return { entries, started: funnel?.create_started ?? 0, purchases: funnel?.purchase ?? 0 };
  };
  const anyConnected = social?.networks.some((network) => network.connected) ?? false;

  return (
    <>
      <PageHeader
        title="Redes sociales"
        text="Seguidores, alcance y clics de Instagram, TikTok y Pinterest, leídos por sus APIs una vez al día, y las visitas que cada red trae al sitio. Solo lectura: nada se publica desde acá."
        actions={
          <div className="flex flex-wrap gap-2">
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
            <button
              type="button"
              disabled={syncing || !anyConnected}
              onClick={() => {
                void syncNow();
              }}
              className="h-8 rounded-md border px-3 text-sm disabled:opacity-50"
            >
              {syncing ? 'Leyendo…' : 'Actualizar ahora'}
            </button>
          </div>
        }
      />
      {error && <Notice tone="error">{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {social && (
        <div className="grid gap-4">
          {social.networks.map((network) => {
            const visits = visitsOf(network.network);
            return (
              <Card key={network.network}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-semibold">
                    {LABELS[network.network]}{' '}
                    <a
                      className="text-sm font-normal text-primary underline-offset-4 hover:underline"
                      href={PROFILE_URL[network.network](network.handle)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      @{network.handle}
                    </a>
                  </h2>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {network.canAuthorize && (
                      <button
                        type="button"
                        onClick={() => {
                          void connectTikTok(true);
                        }}
                        className="h-7 rounded-md border px-2 text-xs text-foreground"
                      >
                        {network.connected ? 'Volver a conectar TikTok' : 'Conectar TikTok'}
                      </button>
                    )}
                    {network.canAuthorize && (
                      <button
                        type="button"
                        title="Para apps en Sandbox, que no tienen el permiso de videos"
                        onClick={() => {
                          void connectTikTok(false);
                        }}
                        className="h-7 rounded-md border px-2 text-xs text-foreground"
                      >
                        Conectar sin videos (Sandbox)
                      </button>
                    )}
                    {network.connected
                      ? `Última lectura: ${when(network.lastRunAt)}`
                      : 'Sin conectar'}
                  </span>
                </div>
                {network.error && (
                  <p className="mt-2">
                    <Notice tone="error">{network.error}</Notice>
                  </p>
                )}
                {network.connected ? (
                  <>
                    <div className="mt-3 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                      <Kpi
                        label="Seguidores"
                        value={num(network.followers)}
                        {...(network.followersChange !== null
                          ? {
                              hint: `${network.followersChange >= 0 ? '+' : ''}${nf.format(network.followersChange)} en el período`,
                            }
                          : {})}
                      />
                      <Kpi label="Impresiones" value={num(network.impressions)} />
                      <Kpi label="Alcance" value={num(network.reach)} />
                      <Kpi label="Clics al sitio" value={num(network.clicks)} />
                      {network.network === 'instagram' && (
                        <Kpi label="Visitas al perfil" value={num(network.profileVisits)} />
                      )}
                      {network.network === 'tiktok' && (
                        <>
                          <Kpi label="Me gusta" value={num(network.likes)} />
                          <Kpi
                            label="Videos"
                            value={num(network.videos.length ? network.videos.length : null)}
                            hint="Los últimos publicados"
                          />
                          <Kpi
                            label="Vistas (últimos videos)"
                            value={num(network.videoViews)}
                            hint="Acumulado de los últimos 20"
                          />
                        </>
                      )}
                    </div>
                    {network.videos.length > 0 && (
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-left text-xs text-muted-foreground">
                            <tr>
                              <th className="py-1 pr-3 font-normal">Video</th>
                              <th className="px-2 font-normal">Vistas</th>
                              <th className="px-2 font-normal">Me gusta</th>
                              <th className="px-2 font-normal">Comentarios</th>
                              <th className="px-2 font-normal">Compartidos</th>
                            </tr>
                          </thead>
                          <tbody>
                            {network.videos.map((video) => (
                              <tr key={video.id} className="border-t">
                                <td className="max-w-xs truncate py-1 pr-3">
                                  {video.url ? (
                                    <a
                                      className="text-primary underline-offset-4 hover:underline"
                                      href={video.url}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {video.title || 'Sin título'}
                                    </a>
                                  ) : (
                                    video.title || 'Sin título'
                                  )}
                                  {video.createdAt && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      {when(video.createdAt)}
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 tabular-nums">{num(video.views)}</td>
                                <td className="px-2 tabular-nums">{num(video.likes)}</td>
                                <td className="px-2 tabular-nums">{num(video.comments)}</td>
                                <td className="px-2 tabular-nums">{num(video.shares)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <Bars
                      label="Impresiones por día"
                      values={network.daily.map((row) => ({
                        day: row.day,
                        value: row.impressions,
                      }))}
                    />
                  </>
                ) : (
                  <div className="mt-3 text-sm">
                    <p className="mb-1 text-muted-foreground">
                      Para conectarla hacen falta estos pasos (las claves se cargan en Secret
                      Manager, nunca en el código):
                    </p>
                    <ol className="list-decimal space-y-1 pl-5">
                      {SETUP[network.network].map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
                <div className="mt-4 grid gap-4 border-t pt-3 sm:grid-cols-4">
                  <Kpi
                    label="Entradas al sitio"
                    value={nf.format(visits.entries)}
                    hint="Con utm o enlace de la red"
                  />
                  <Kpi label="Empezaron un cuento" value={nf.format(visits.started)} />
                  <Kpi label="Compras" value={nf.format(visits.purchases)} />
                  <Kpi
                    label="Clic → entrada"
                    value={network.clicks ? pct(visits.entries, network.clicks) : '—'}
                    hint="Entradas del sitio sobre clics de la red"
                  />
                </div>
              </Card>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Pinterest tarda hasta 48 h en cerrar cada día. Instagram informa el día anterior. TikTok
            solo informa seguidores y las vistas de los últimos videos, no números por día. Las
            visitas salen del panel «Visitas y campañas», que cuenta sin cookies; usá enlaces con
            UTM en cada bio y publicación para que no caigan en «Directo».
          </p>
        </div>
      )}
      {!social && !error && (
        <p className="text-sm text-muted-foreground">Cargando… ({SOCIAL_NETWORKS.length} redes)</p>
      )}
    </>
  );
}
