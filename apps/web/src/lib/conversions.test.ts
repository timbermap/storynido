import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CONVERSION_EVENT, trackConversion, type ConversionDetail } from './conversions';

describe('eventos de conversión', () => {
  const store = new Map<string, string>();
  const sent: ConversionDetail[] = [];

  beforeEach(() => {
    store.clear();
    sent.length = 0;
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
      },
      dispatchEvent: (event: CustomEvent<ConversionDetail>) => {
        if (event.type === CONVERSION_EVENT) sent.push(event.detail);
        return true;
      },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('manda cada conversión una sola vez por clave', () => {
    const detail: ConversionDetail = { name: 'purchase', value: 21.99, currency: 'USD' };
    trackConversion('purchase:abc', detail);
    trackConversion('purchase:abc', detail);
    trackConversion('purchase:def', detail);
    expect(sent).toHaveLength(2);
  });

  it('manda igual si no hay almacenamiento', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('bloqueado');
        },
        setItem: () => undefined,
      },
      dispatchEvent: (event: CustomEvent<ConversionDetail>) => {
        sent.push(event.detail);
        return true;
      },
    });
    trackConversion('begin:x', { name: 'begin_checkout', value: 10, currency: 'USD' });
    expect(sent).toHaveLength(1);
  });
});
