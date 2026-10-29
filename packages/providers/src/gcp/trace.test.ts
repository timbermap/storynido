import { describe, expect, it, vi } from 'vitest';

import { CloudTraceSink, cloudTraceSpan } from './trace';

const span = {
  traceId: '105445aa7843bc8bf206b12000100000',
  spanId: '00000000000000ff',
  name: 'api GET /v1/catalog',
  start: new Date('2026-10-28T12:00:00Z'),
  end: new Date('2026-10-28T12:00:01Z'),
  attributes: { '/http/status_code': 200, '/http/method': 'GET', cached: true },
};

describe('Cloud Trace', () => {
  it('arma el span de la API v2', () => {
    expect(cloudTraceSpan('p', span)).toEqual({
      name: 'projects/p/traces/105445aa7843bc8bf206b12000100000/spans/00000000000000ff',
      spanId: '00000000000000ff',
      displayName: { value: 'api GET /v1/catalog' },
      startTime: '2026-10-28T12:00:00.000Z',
      endTime: '2026-10-28T12:00:01.000Z',
      spanKind: 'SERVER',
      attributes: {
        attributeMap: {
          '/http/status_code': { intValue: '200' },
          '/http/method': { stringValue: { value: 'GET' } },
          cached: { boolValue: true },
        },
      },
    });
  });

  it('junta los spans y los manda juntos; un error no se propaga', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(new Response('{}')));
    const onError = vi.fn();
    const sink = new CloudTraceSink({
      projectId: 'p',
      getAccessToken: () => Promise.resolve('t'),
      fetch,
      onError,
    });
    sink.record(span);
    sink.record({ ...span, spanId: '0000000000000100' });
    await sink.flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('https://cloudtrace.googleapis.com/v2/projects/p/traces:batchWrite');
    expect((JSON.parse(init?.body as string) as { spans: unknown[] }).spans).toHaveLength(2);
    await sink.flush();
    expect(fetch).toHaveBeenCalledTimes(1);

    fetch.mockResolvedValueOnce(new Response('denied', { status: 403 }));
    sink.record(span);
    await sink.close();
    expect(String(onError.mock.calls[0]?.[0])).toContain('403');
  });
});
