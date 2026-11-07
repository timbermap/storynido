import { DEFAULT_PRODUCT_PRICING, type PrintProvider } from '@storynido/shared';
import { MockPrintProvider } from '@storynido/providers';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { FastifyBaseLogger } from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';

import { PriceCostRefresh, sampleItem } from './price-costs';

const app = getApps()[0] ?? initializeApp({ projectId: 'demo-storynido-test' });
const db = getFirestore(app);
const log = { info: () => undefined, warn: () => undefined } as unknown as FastifyBaseLogger;
const now = new Date('2026-11-07T15:00:00Z');

const option = (provider: string, cost: number) => ({
  country: 'MX',
  format: 'hardcover',
  provider,
  sku: `${provider}-hardcover`,
  enabled: true,
  qaSamplePassed: true,
  pages: { min: 24, max: 200, multipleOf: 2 },
  maxQuantity: 100,
  etaDaysMin: 3,
  etaDaysMax: 6,
  productionCostUsdMinor: cost,
  updatedAt: new Date('2026-11-01T00:00:00Z'),
});

/** Una imprenta que hoy cotiza más caro (la tapa dura a USD 15,50). */
const pricier = new MockPrintProvider('secreto', {
  id: 'mock',
  productionUsdMinor: { softcover: 900, hardcover: 1550, booklet: 700, card: 25 },
  shippingUsdMinor: { MX: 826 },
});
const broken = {
  id: 'roto',
  quote: () => Promise.reject(new Error('API caída')),
} as unknown as PrintProvider;

describe('costos que siguen a la realidad (DECISIONS 241)', () => {
  beforeEach(async () => {
    for (const name of ['printOptions', 'productPricing', 'orders', 'books', 'aiUsage']) {
      await db.recursiveDelete(db.collection(name));
    }
  });

  it('cotiza un libro clásico de cada formato (el grapado, de 12 páginas)', () => {
    expect(
      sampleItem({ format: 'hardcover', pages: { min: 24, max: 200, multipleOf: 2 } }),
    ).toEqual({ format: 'hardcover', pageCount: 28, quantity: 1 });
    expect(sampleItem({ format: 'booklet', pages: { min: 8, max: 24, multipleOf: 4 } })).toEqual({
      format: 'booklet',
      pageCount: 16,
      quantity: 1,
    });
  });

  it('la matriz toma lo que cotiza la imprenta hoy; si falla, queda el valor anterior y avisa', async () => {
    await db.doc('printOptions/MX_hardcover_mock').set(option('mock', 1400));
    await db.doc('printOptions/MX_hardcover_roto').set(option('roto', 1300));
    const alerts: string[] = [];
    const job = new PriceCostRefresh(
      db,
      () => [pricier, broken],
      {
        adminAlert: (alert) => {
          alerts.push(alert.message);
          return Promise.resolve();
        },
      },
      log,
      () => now,
    );
    expect(await job.printCosts()).toEqual({ updated: 1, failed: ['MX_hardcover_roto'] });

    const updated = (await db.doc('printOptions/MX_hardcover_mock').get()).data();
    expect(updated?.productionCostUsdMinor).toBe(1550);
    expect(updated?.autoPricing).toMatchObject({ previousCostUsdMinor: 1400, error: null });
    expect((updated?.autoPricing as { updatedAt: { toDate(): Date } }).updatedAt.toDate()).toEqual(
      now,
    );

    const kept = (await db.doc('printOptions/MX_hardcover_roto').get()).data();
    expect(kept?.productionCostUsdMinor).toBe(1300);
    expect(kept?.autoPricing).toMatchObject({ error: 'API caída' });
    expect(alerts[0]).toContain('MX_hardcover_roto');
  });

  it('el costo de IA por página sale de los libros pagados; fijado a mano, no se toca', async () => {
    await db
      .doc('productPricing/digital')
      .set({ ...DEFAULT_PRODUCT_PRICING.digital, updatedAt: now });
    await db
      .doc('productPricing/hardcover')
      .set({ ...DEFAULT_PRODUCT_PRICING.hardcover, aiCostManual: true, updatedAt: now });
    for (let index = 0; index < 20; index += 1) {
      const bookId = `b${String(index)}`;
      await db.doc(`orders/o${String(index)}`).set({
        bookId,
        status: 'delivered',
        channel: 'families',
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      });
      await db.doc(`books/${bookId}`).set({ preview: { interiorPages: 28 } });
      // 5,60 USD de IA por libro de 28 páginas: 20 centavos por página.
      await db.collection('aiUsage').add({
        day: '2026-11-02',
        kind: 'illustration',
        provider: 'vertex',
        model: 'imagen',
        costUsdMicros: 5_600_000,
        ownerUid: null,
        bookId,
        orderId: null,
        at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      });
    }
    const job = new PriceCostRefresh(
      db,
      () => [],
      { adminAlert: () => Promise.resolve() },
      log,
      () => now,
    );
    const result = await job.aiCost();
    expect(result).toMatchObject({
      measured: { perPageUsdMinor: 20, books: 20 },
      applied: ['digital'],
    });

    const digital = (await db.doc('productPricing/digital').get()).data();
    expect(digital?.aiCostPerPageUsdMinor).toBe(20);
    // El margen nunca cambia solo.
    expect(digital?.creationMargin).toEqual(DEFAULT_PRODUCT_PRICING.digital.creationMargin);
    expect(digital?.aiCostAuto).toMatchObject({ perPageUsdMinor: 20, previousUsdMinor: 15 });

    const hardcover = (await db.doc('productPricing/hardcover').get()).data();
    expect(hardcover?.aiCostPerPageUsdMinor).toBe(15);
    expect(hardcover?.aiCostAuto).toMatchObject({ perPageUsdMinor: 20, previousUsdMinor: null });
  });
});
