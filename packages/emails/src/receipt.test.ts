import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { receiptFilename, renderReceiptPdf, receiptSchema, type ReceiptData } from './receipt';
import { RECEIPT_SAMPLE } from './samples';

describe('comprobante de compra en PDF', () => {
  it('arma un PDF de una página con el título del documento', async () => {
    const bytes = await renderReceiptPdf(RECEIPT_SAMPLE);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toContain(RECEIPT_SAMPLE.number);
  });

  it.each(['es', 'en', 'pt'] as const)('sale en %s con tildes, ñ y ç', async (locale) => {
    const data: ReceiptData = {
      ...RECEIPT_SAMPLE,
      locale,
      lines: [
        {
          description: 'Mañana de aventuras con João y la abuela — ¡Qué día! ç ã ñ',
          detail: null,
          quantity: 1,
          amount: 'USD 14.99',
        },
      ],
    };
    expect((await renderReceiptPdf(data)).length).toBeGreaterThan(5000);
  });

  it('no manda fiscal: el nombre del archivo usa el número de pedido', () => {
    expect(receiptFilename(RECEIPT_SAMPLE)).toBe('comprobante-storynido-SN-3F9K2LQA.pdf');
    expect(receiptFilename({ ...RECEIPT_SAMPLE, locale: 'en' })).toMatch(/^storynido-receipt-/);
  });

  it('rechaza un comprobante sin líneas', () => {
    expect(receiptSchema.safeParse({ ...RECEIPT_SAMPLE, lines: [] }).success).toBe(false);
  });

  it('con descuento, envío e impuestos también se arma', async () => {
    const bytes = await renderReceiptPdf({
      ...RECEIPT_SAMPLE,
      discount: { label: 'BIENVENIDA', amount: 'USD 3.00' },
      shipping: 'USD 6.50',
      tax: { amount: 'USD 2.10', included: false },
    });
    expect(bytes.length).toBeGreaterThan(5000);
  });
});
