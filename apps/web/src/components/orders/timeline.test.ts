import { describe, expect, it } from 'vitest';

import { orderGroup } from './timeline';

describe('orderGroup', () => {
  it('lo que se está armando va en «Creando»', () => {
    for (const status of ['pending_payment', 'paid', 'generating', 'qa_failed'] as const) {
      expect(orderGroup(status, false)).toBe('creating');
      expect(orderGroup(status, true)).toBe('creating');
    }
  });

  it('la imprenta y el envío van en «En curso»', () => {
    for (const status of ['sent_to_print', 'in_production', 'shipped'] as const) {
      expect(orderGroup(status, true)).toBe('inProgress');
    }
    expect(orderGroup('ready', true)).toBe('inProgress');
  });

  it('un digital listo va directo a «Entregados», igual que un impreso entregado', () => {
    expect(orderGroup('ready', false)).toBe('delivered');
    expect(orderGroup('delivered', true)).toBe('delivered');
  });

  it('cancelados y reembolsados quedan aparte', () => {
    expect(orderGroup('cancelled', false)).toBe('closed');
    expect(orderGroup('refunded', true)).toBe('closed');
  });
});
