import { describe, expect, it } from 'vitest';

import { isExternalTabPayment } from './payment-url';

describe('pago en otra pestaña', () => {
  it('Gumroad se abre en otra pestaña; el resto de los cobradores, en esta', () => {
    expect(isExternalTabPayment('https://storynidoar.gumroad.com/l/cjlkhc?wanted=true')).toBe(true);
    expect(isExternalTabPayment('https://gumroad.com/l/abc')).toBe(true);
    expect(isExternalTabPayment('https://test.checkout.dodopayments.com/cks_1')).toBe(false);
    expect(isExternalTabPayment('https://staging.storynido.com/es/pedido/o1?mock_session=x')).toBe(
      false,
    );
    expect(isExternalTabPayment('https://evil-gumroad.com/l/x')).toBe(false);
    expect(isExternalTabPayment('no es una url')).toBe(false);
  });
});
