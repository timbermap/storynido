import { describe, expect, it } from 'vitest';

import { EVENT_TYPES, INVITATION_TONES, invitationCopy } from './events';

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
