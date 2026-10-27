import { describe, expect, it } from 'vitest';

import { gcpPost } from './gcp';

describe('gcpPost', () => {
  it('pide el token al servidor de metadatos y lo usa en la llamada', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fakeFetch: typeof fetch = (input, init) => {
      calls.push({ url: input instanceof Request ? input.url : input.toString(), init });
      const body = calls.length === 1 ? { access_token: 'tok' } : { ok: true };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    };
    const res = await gcpPost('https://example.googleapis.com/v1/x', { a: 1 }, fakeFetch);

    expect(calls[0]?.url).toBe(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    );
    expect(calls[0]?.init?.headers).toEqual({ 'Metadata-Flavor': 'Google' });
    expect(calls[1]?.init?.headers).toMatchObject({ Authorization: 'Bearer tok' });
    expect(res).toEqual({ status: 200, json: { ok: true } });
  });
});
