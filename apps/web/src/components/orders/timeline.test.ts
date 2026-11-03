import { describe, expect, it } from 'vitest';

import { orderGroup, timelineFor } from './timeline';

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

describe('timelineFor', () => {
  it('el impreso tiene cinco pasos y el pago es uno solo', () => {
    expect(timelineFor('pending_payment', true)).toEqual({
      steps: ['paid', 'creating', 'printing', 'shipping', 'delivered'],
      current: 0,
    });
    expect(timelineFor('paid', true).current).toBe(1);
    expect(timelineFor('generating', true).current).toBe(1);
  });

  it('la imprenta y el envío avanzan en el impreso', () => {
    for (const status of ['ready', 'sent_to_print', 'in_production'] as const) {
      expect(timelineFor(status, true).current).toBe(2);
    }
    expect(timelineFor('shipped', true).current).toBe(3);
    expect(timelineFor('delivered', true).current).toBe(4);
  });

  it('el digital salta la imprenta y el envío: listo es entregado', () => {
    expect(timelineFor('generating', false)).toEqual({
      steps: ['paid', 'creating', 'delivered'],
      current: 1,
    });
    expect(timelineFor('ready', false).current).toBe(2);
  });

  it('cancelados y reembolsados no tienen línea de tiempo', () => {
    expect(timelineFor('cancelled', true).current).toBe(-1);
    expect(timelineFor('refunded', false).current).toBe(-1);
  });
});
