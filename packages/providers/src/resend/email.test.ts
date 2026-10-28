import { DEFAULT_BRAND, SAMPLE_DATA } from '@storynido/emails';
import { describe, expect, it } from 'vitest';

import { ResendEmailProvider } from './email';

function fake(status = 200) {
  const calls: { headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  const fetchImpl = ((_url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(init?.body as string) as Record<string, unknown>,
    });
    return Promise.resolve(
      new Response(JSON.stringify(status === 200 ? { id: 'em_1' } : { message: 'no' }), { status }),
    );
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const provider = (fetchImpl: typeof fetch) =>
  new ResendEmailProvider({
    apiKey: 're_test',
    from: 'StoryNido <hola@storynido.com>',
    brand: DEFAULT_BRAND,
    fetchImpl,
  });

describe('Resend', () => {
  it('manda el mail armado, con clave idempotente y baja en un clic en marketing', async () => {
    const api = fake();
    const result = await provider(api.fetchImpl).send({
      to: 'ana@example.com',
      template: 'review_request',
      locale: 'es',
      data: SAMPLE_DATA.review_request,
      idempotencyKey: 'order:o1:review_request',
    });
    expect(result.messageId).toBe('em_1');
    const call = api.calls[0];
    expect(call?.headers['Idempotency-Key']).toBe('order:o1:review_request');
    expect(call?.body).toMatchObject({
      from: 'StoryNido <hola@storynido.com>',
      to: ['ana@example.com'],
      subject: expect.stringContaining('La gran aventura espacial') as string,
      headers: { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    });
    expect(String(call?.body.html)).toContain('Dejar mi opinión');
  });

  it('un mail transaccional no lleva baja; un 5xx se puede reintentar', async () => {
    const api = fake();
    await provider(api.fetchImpl).send({
      to: 'ana@example.com',
      template: 'shipped',
      locale: 'en',
      data: SAMPLE_DATA.shipped,
      idempotencyKey: 'k',
    });
    expect(api.calls[0]?.body.headers).toBeUndefined();
    const down = fake(503);
    await expect(
      provider(down.fetchImpl).send({
        to: 'ana@example.com',
        template: 'shipped',
        locale: 'en',
        data: SAMPLE_DATA.shipped,
        idempotencyKey: 'k',
      }),
    ).rejects.toMatchObject({ retryable: true });
  });
});
