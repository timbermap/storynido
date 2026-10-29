import { describe, expect, it } from 'vitest';

import {
  cloudLoggingOptions,
  cloudTraceHeader,
  orderLogFields,
  orderTraceId,
  parseServiceEnv,
  requestSpan,
  traceLogFields,
} from './index';

describe('server utils', () => {
  it('mapea niveles de pino a severidades de Cloud Logging', () => {
    const { formatters } = cloudLoggingOptions('api', 'info');
    expect(formatters.level('warn')).toEqual({ severity: 'WARNING' });
    expect(formatters.level('desconocido')).toEqual({ severity: 'DEFAULT' });
  });

  it('los errores salen con lo que necesita Error Reporting (tipo, servicio, versión y pila)', () => {
    const options = cloudLoggingOptions('worker', 'info', 'worker-00042');
    expect(options.mixin({}, 30)).toEqual({});
    const reported = options.mixin({}, 50) as { '@type'?: string; serviceContext?: object };
    expect(reported['@type']).toContain('ReportedErrorEvent');
    expect(reported.serviceContext).toEqual({ service: 'worker', version: 'worker-00042' });
    const error = new Error('boom');
    const line = options.formatters.log({ err: { stack: error.stack } }) as {
      stack_trace?: string;
    };
    expect(line.stack_trace).toContain('Error: boom');
  });

  it('span del request: solo si viene muestreado, con el span de la cabecera', () => {
    const trace = '105445aa7843bc8bf206b12000100000';
    const request = {
      method: 'POST',
      route: '/run/:step',
      status: 200,
      elapsedMs: 1500,
      service: 'worker',
    };
    const now = new Date('2026-10-28T12:00:00Z');
    expect(requestSpan(`${trace}/255;o=1`, request, now)).toEqual({
      traceId: trace,
      spanId: '00000000000000ff',
      name: 'worker POST /run/:step',
      start: new Date('2026-10-28T11:59:58.500Z'),
      end: now,
      attributes: {
        '/http/method': 'POST',
        '/http/route': '/run/:step',
        '/http/status_code': 200,
        'g.co/gae/app/module': 'worker',
      },
    });
    expect(requestSpan(`${trace};o=1`, request)?.spanId).toMatch(/^[\da-f]{16}$/);
    expect(requestSpan(`${trace}/1;o=0`, request)).toBeNull();
    expect(requestSpan(undefined, request)).toBeNull();
  });

  it('traza: lee la cabecera de Cloud Trace o la W3C; la del pedido es estable', () => {
    const trace = '105445aa7843bc8bf206b12000100000';
    expect(traceLogFields(`${trace}/1;o=1`, 'p')).toEqual({
      'logging.googleapis.com/trace': `projects/p/traces/${trace}`,
      'logging.googleapis.com/spanId': '0000000000000001',
      'logging.googleapis.com/trace_sampled': true,
    });
    expect(traceLogFields(`00-${trace}-00f067aa0ba902b7-01`, 'p')).toMatchObject({
      'logging.googleapis.com/spanId': '00f067aa0ba902b7',
      'logging.googleapis.com/trace_sampled': true,
    });
    expect(traceLogFields(undefined, 'p')).toEqual({});
    expect(traceLogFields('basura', 'p')).toEqual({});

    const id = orderTraceId('o1');
    expect(id).toMatch(/^[\da-f]{32}$/);
    expect(orderTraceId('o1')).toBe(id);
    expect(cloudTraceHeader(id)).toMatch(new RegExp(`^${id}/\\d+;o=1$`));
    expect(orderLogFields('o1', 'p')).toEqual({
      orderId: 'o1',
      'logging.googleapis.com/trace': `projects/p/traces/${id}`,
    });
  });

  it('usa el puerto por defecto y respeta PORT', () => {
    expect(parseServiceEnv({}, 8080).PORT).toBe(8080);
    expect(parseServiceEnv({ PORT: '9000' }, 8080).PORT).toBe(9000);
  });

  it('rechaza variables inválidas', () => {
    expect(() => parseServiceEnv({ LOG_LEVEL: 'verbose' }, 8080)).toThrow();
  });
});
