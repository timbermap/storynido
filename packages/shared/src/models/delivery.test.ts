import { describe, expect, it } from 'vitest';

import { addBusinessDays, deliveryWindow, giftDeadlineStatus } from './delivery';

// Miércoles 28 de octubre de 2026.
const now = new Date('2026-10-28T15:00:00Z');

describe('fecha del regalo (escenario 22)', () => {
  it('cuenta solo días hábiles', () => {
    expect(addBusinessDays(now, 2).toISOString().slice(0, 10)).toBe('2026-10-30');
    expect(addBusinessDays(now, 3).toISOString().slice(0, 10)).toBe('2026-11-02');
    expect(addBusinessDays(now, 0).toISOString().slice(0, 10)).toBe('2026-10-28');
  });

  it('suma la producción a los días de envío de la imprenta', () => {
    const { earliest, latest } = deliveryWindow(now, 4, 8);
    expect(earliest.toISOString().slice(0, 10)).toBe('2026-11-06'); // 7 días hábiles
    expect(latest.toISOString().slice(0, 10)).toBe('2026-11-12'); // 11 días hábiles
  });

  it('nunca promete antes de lo posible', () => {
    expect(giftDeadlineStatus('2026-11-20', now, 4, 8)).toBe('on_time');
    expect(giftDeadlineStatus('2026-11-12', now, 4, 8)).toBe('on_time');
    expect(giftDeadlineStatus('2026-11-09', now, 4, 8)).toBe('at_risk');
    expect(giftDeadlineStatus('2026-11-05', now, 4, 8)).toBe('late');
    expect(giftDeadlineStatus('2026-10-29', now, 4, 8)).toBe('late');
  });
});
