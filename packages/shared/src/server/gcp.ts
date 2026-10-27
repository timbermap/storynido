/**
 * Token de acceso de la cuenta de servicio del servicio de Cloud Run (servidor de metadatos).
 * Evita sumar SDKs de Google solo para llamar a Pub/Sub, Cloud Tasks o Workflows por REST.
 */
export async function gcpAccessToken(fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-account/default/token',
    { headers: { 'Metadata-Flavor': 'Google' } },
  );
  if (!res.ok) throw new Error(`Metadata token: HTTP ${String(res.status)}`);
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error('Metadata token: respuesta sin access_token');
  return body.access_token;
}

/** POST JSON a una API de Google con el token de la cuenta de servicio. */
export async function gcpPost(
  url: string,
  body: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: number; json: unknown }> {
  const token = await gcpAccessToken(fetchImpl);
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}
