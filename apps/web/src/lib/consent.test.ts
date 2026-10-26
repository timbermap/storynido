import { describe, expect, it } from 'vitest';

import { parseConsent, serializeConsent } from './consent';

describe('consentimiento de cookies', () => {
  it('serializa y lee la elección', () => {
    const choice = { analytics: true, marketing: false };
    expect(parseConsent(serializeConsent(choice))).toEqual(choice);
  });

  it('sin cookie, o con otra versión, no hay decisión', () => {
    expect(parseConsent(undefined)).toBeNull();
    expect(parseConsent('v0.a1.m1')).toBeNull();
    expect(parseConsent('cualquier-cosa')).toBeNull();
  });
});
