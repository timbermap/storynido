import { describe, expect, it } from 'vitest';

import { EVENT_TYPES, INVITATION_TONES, formatEventTime, invitationCopy } from './events';

describe('tono de la invitación por ocasión', () => {
  it('cada ocasión, idioma y tono tiene nombre y dos frases, y solo el cumpleaños dice cumple', () => {
    for (const language of ['es', 'en', 'pt'] as const) {
      for (const type of EVENT_TYPES) {
        for (const tone of INVITATION_TONES) {
          const copy = invitationCopy(language, type, tone);
          expect(copy.name && copy.invite && copy.waiting).toBeTruthy();
          if (type !== 'birthday') {
            expect(`${copy.invite} ${copy.waiting}`.toLowerCase()).not.toMatch(
              /cumple|birthday|aniversário/,
            );
          }
        }
      }
    }
  });

  it('bautismo y comunión: Alegre, Tierno y Emotivo; sin ocasión, el cumpleaños', () => {
    expect(INVITATION_TONES.map((tone) => invitationCopy('es', 'baptism', tone).name)).toEqual([
      'Alegre',
      'Tierno',
      'Emotivo',
    ]);
    expect(invitationCopy('pt', 'communion', 'fun').invite).toBe(
      'Venha para a minha primeira comunhão!',
    );
    expect(invitationCopy('es', null, null).invite).toBe('¡Te invito a mi cumple!');
  });
});

describe('hora de la fiesta en la invitación', () => {
  it('formato de cada idioma, con hora de fin opcional; sin hora, nada', () => {
    expect(formatEventTime('es', '16:30')).toBe('16:30 h');
    expect(formatEventTime('es', '16:30', '19:30')).toBe('de 16:30 a 19:30 h');
    expect(formatEventTime('pt', '16:30', '19:30')).toBe('das 16:30 às 19:30');
    expect(formatEventTime('en', '16:30')).toBe('4:30 PM');
    expect(formatEventTime('en', '09:05', '12:00')).toBe('9:05 AM – 12:00 PM');
    expect(formatEventTime('es', null, '19:30')).toBeNull();
    expect(formatEventTime('es', '25:00')).toBeNull();
  });
});
