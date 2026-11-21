import { describe, expect, it } from 'vitest';

import { attributionFor, hasOrigin, readEntry } from './traffic';

describe('readEntry', () => {
  it('lee utm_content, utm_term y qué identificador de clic trae (sin su valor)', () => {
    const entry = readEntry(
      '?utm_source=instagram&utm_content=reel-1&utm_term=cumple&fbclid=ABC123',
      '',
      'storynido.com',
    );
    expect(entry).toMatchObject({
      utmSource: 'instagram',
      utmContent: 'reel-1',
      utmTerm: 'cumple',
      clickId: 'fbclid',
    });
    expect(JSON.stringify(entry)).not.toContain('ABC123');
  });
  it('un enlace con solo ttclid ya tiene origen y cuenta como TikTok', () => {
    const entry = readEntry('?ttclid=xyz', '', 'storynido.com');
    expect(hasOrigin(entry)).toBe(true);
    expect(attributionFor(entry).source).toBe('tiktok');
  });
  it('sin pistas no hay origen', () => {
    expect(hasOrigin(readEntry('', '', 'storynido.com'))).toBe(false);
  });
});
