import { describe, expect, it } from 'vitest';

import { isExternalTabPayment, paypalOrderId } from './payment-url';

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

describe('paypalOrderId', () => {
  it('lee la orden del enlace de pago de PayPal (sandbox y real)', () => {
    expect(
      paypalOrderId('https://www.sandbox.paypal.com/checkoutnow?token=6PB25671TM886432T'),
    ).toBe('6PB25671TM886432T');
    expect(paypalOrderId('https://www.paypal.com/checkoutnow?token=ABC')).toBe('ABC');
  });

  it('otros cobradores o enlaces raros: null', () => {
    expect(paypalOrderId('https://storynidoar.gumroad.com/l/libro?wanted=true')).toBeNull();
    expect(paypalOrderId('https://evil.example/paypal.com?token=X')).toBeNull();
    expect(paypalOrderId('https://paypal.com.evil.example/checkoutnow?token=X')).toBeNull();
    expect(paypalOrderId('no es una url')).toBeNull();
  });
});
