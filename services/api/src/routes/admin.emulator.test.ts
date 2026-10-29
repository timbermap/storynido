import { COLLECTIONS, utcDay } from '@storynido/shared';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { initFirebaseAdmin } from '../firebase';
import { auth, createTestApp } from '../test-helpers';

const db = getFirestore(initFirebaseAdmin('demo-storynido-test'));
const ADMIN = 'token-admin:admin:mfa';

type App = Awaited<ReturnType<typeof createTestApp>>['app'];

describe('admin: interruptor del sitio y auditoría', () => {
  let app: App;

  beforeAll(async () => {
    app = (await createTestApp({}, { ADMIN_MFA_REQUIRED: 'true' })).app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.siteConfig,
      COLLECTIONS.auditLog,
      COLLECTIONS.prices,
      COLLECTIONS.coupons,
      COLLECTIONS.promotions,
      COLLECTIONS.content,
      COLLECTIONS.lessons,
      COLLECTIONS.orders,
      COLLECTIONS.metricsDaily,
      COLLECTIONS.fxRates,
      COLLECTIONS.aiUsage,
      COLLECTIONS.aiBudget,
    ]) {
      await db.recursiveDelete(db.collection(name));
    }
  });

  const setMode = (mode: string, token = ADMIN) =>
    app.inject({
      method: 'PUT',
      url: '/v1/admin/site-config',
      headers: auth(token),
      payload: { mode },
    });

  it('el admin cambia el modo; queda en siteConfig y en la auditoría con el antes y el después', async () => {
    const res = await setMode('maintenance');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ mode: 'maintenance', updatedBy: 'admin@storynido.test' });
    expect((await db.doc('siteConfig/global').get()).get('mode')).toBe('maintenance');

    await setMode('live');
    const log = await app.inject({
      method: 'GET',
      url: '/v1/admin/audit-log?entity=siteConfig',
      headers: auth(ADMIN),
    });
    const { entries } = log.json<{
      entries: { action: string; before: unknown; after: unknown; actorEmail: string }[];
    }>();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      action: 'site_config.update',
      actorEmail: 'admin@storynido.test',
      before: { mode: 'maintenance' },
      after: { mode: 'live' },
    });
    expect(entries[1]).toMatchObject({ before: { mode: 'live' }, after: { mode: 'maintenance' } });
  });

  it('ni un customer ni un admin sin segundo factor lo cambian (y no queda nada escrito)', async () => {
    expect((await setMode('maintenance', 'token-ana')).statusCode).toBe(403);
    expect((await setMode('maintenance', 'token-admin:admin')).statusCode).toBe(403);
    expect((await db.doc('siteConfig/global').get()).exists).toBe(false);
    expect((await db.collection(COLLECTIONS.auditLog).get()).empty).toBe(true);
  });

  it('rechaza un modo que no existe', async () => {
    expect((await setMode('apagado')).statusCode).toBe(400);
  });

  const save = (kind: string, id: string, payload: object, token = ADMIN) =>
    app.inject({
      method: 'PUT',
      url: `/v1/admin/config/${kind}/${id}`,
      headers: auth(token),
      payload,
    });

  const pricing = {
    product: 'digital',
    baseCostUsdMinor: 100,
    marginMode: 'fixed',
    marginFixedUsdMinor: 1899,
    marginPercent: 0,
    lengthAdjustmentsUsdMinor: {},
    proPercentOff: 10,
    active: true,
  };

  it('márgenes: el id es el producto; crear y actualizar quedan auditados con el antes', async () => {
    const wrong = await save('productPricing', 'hardcover', pricing);
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json()).toMatchObject({ error: { message: 'El id tiene que ser "digital".' } });
    const bad = await save('productPricing', 'digital', { ...pricing, marginMode: 'lo que sea' });
    expect(bad.statusCode).toBe(400);

    expect((await save('productPricing', 'digital', pricing)).statusCode).toBe(200);
    const percent = { ...pricing, marginMode: 'percent_min', marginPercent: 60 };
    expect((await save('productPricing', 'digital', percent)).statusCode).toBe(200);
    expect((await db.doc('productPricing/digital').get()).get('marginMode')).toBe('percent_min');

    const { entries } = (
      await app.inject({
        method: 'GET',
        url: '/v1/admin/audit-log?entity=productPricing',
        headers: auth(ADMIN),
      })
    ).json<{
      entries: { action: string; before: { marginMode?: string; updatedAt?: string } | null }[];
    }>();
    expect(entries.map((entry) => entry.action)).toEqual([
      'productPricing.update',
      'productPricing.create',
    ]);
    expect(entries[0]?.before?.marginMode).toBe('fixed');
    // Las fechas del antes y el después vuelven como texto ISO.
    expect(entries[0]?.before?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entries[1]?.before).toBeNull();

    const list = await app.inject({
      method: 'GET',
      url: '/v1/admin/config/productPricing',
      headers: auth(ADMIN),
    });
    expect(list.json()).toMatchObject({
      items: [{ id: 'digital', data: { marginPercent: 60 } }],
    });
  });

  it('cupones: fechas desde texto ISO y el contador de usos no lo pisa el admin', async () => {
    const coupon = {
      code: 'BIENVENIDA',
      type: 'percent',
      value: 10,
      currency: null,
      countries: ['MX'],
      validFrom: '2026-11-01T00:00:00.000Z',
      validUntil: null,
      maxRedemptions: 100,
      active: true,
    };
    expect((await save('coupons', 'BIENVENIDA', coupon)).statusCode).toBe(200);
    await db.doc('coupons/BIENVENIDA').update({ redemptions: 7 });
    expect(
      (await save('coupons', 'BIENVENIDA', { ...coupon, redemptions: 0, value: 15 })).statusCode,
    ).toBe(200);
    const stored = (await db.doc('coupons/BIENVENIDA').get()).data();
    expect(stored?.redemptions).toBe(7);
    expect(stored?.value).toBe(15);
    expect((stored?.validFrom as { toDate(): Date }).toDate().toISOString()).toBe(
      '2026-11-01T00:00:00.000Z',
    );
  });

  it('promociones: rechaza fechas al revés y valores fuera de rango, sin escribir', async () => {
    const promo = {
      name: 'Día del Niño',
      discountPercent: 15,
      countries: ['MX'],
      formats: ['digital'],
      startsAt: '2027-04-20T00:00:00.000Z',
      endsAt: '2027-04-10T00:00:00.000Z',
      active: true,
    };
    const backwards = await save('promotions', 'dia-del-nino', promo);
    expect(backwards.statusCode).toBe(400);
    expect(backwards.json()).toMatchObject({ error: { message: /terminar después/ } });
    expect(
      (
        await save('promotions', 'dia-del-nino', {
          ...promo,
          endsAt: '2027-05-01',
          discountPercent: 150,
        })
      ).statusCode,
    ).toBe(400);
    expect((await db.collection(COLLECTIONS.auditLog).get()).empty).toBe(true);
    expect(
      (await save('promotions', 'dia-del-nino', { ...promo, endsAt: '2027-05-01T00:00:00.000Z' }))
        .statusCode,
    ).toBe(200);
  });

  it('contenido: el id es clave_idioma y guarda quién lo cambió', async () => {
    const faq = {
      key: 'faq',
      locale: 'es',
      title: 'Preguntas',
      body: '## ¿Cuánto tarda?',
      published: true,
    };
    expect((await save('content', 'faq_en', faq)).statusCode).toBe(400);
    expect((await save('content', 'faq_es', faq)).statusCode).toBe(200);
    expect((await db.doc('content/faq_es').get()).data()).toMatchObject({
      body: '## ¿Cuánto tarda?',
      updatedBy: 'admin@storynido.test',
    });
  });

  it('enseñanzas: rechaza edades al revés y guarda createdAt al crear', async () => {
    const lesson = {
      slug: 'compartir',
      active: true,
      order: 1,
      group: 'values',
      ageMin: 6,
      ageMax: 3,
      name: { es: 'Compartir', en: 'Sharing', pt: 'Compartilhar' },
      headline: { es: 'Un cuento para compartir', en: 'A story about sharing', pt: 'Uma história' },
      description: { es: 'Descripción', en: 'Description', pt: 'Descrição' },
      promptGuidance: 'Mostrar que compartir suma, sin sermón.',
      sensitive: false,
    };
    const backwards = await save('lessons', 'compartir', lesson);
    expect(backwards.json()).toMatchObject({ error: { message: /edad máxima/ } });
    expect(
      (await save('lessons', 'compartir', { ...lesson, ageMin: 3, ageMax: 8 })).statusCode,
    ).toBe(200);
    expect((await db.doc('lessons/compartir').get()).get('createdAt')).toBeDefined();
  });

  it('catálogo de modelos de IA: solo el superadmin lo cambia', async () => {
    const entry = {
      provider: 'vertex',
      model: 'gemini-3.5-flash',
      kind: 'text',
      price: { inputPerMTok: 0.5, outputPerMTok: 3 },
      dataPolicy: {
        trainsOnData: false,
        humanReview: false,
        regions: ['global'],
        enterpriseAgreement: true,
      },
      allowedEnvironments: ['staging', 'production'],
      childPhotosAllowed: false,
      lastEval: null,
      notes: null,
    };
    expect((await save('aiModels', 'gemini-3.5-flash', entry)).statusCode).toBe(403);
    expect(
      (await save('aiModels', 'gemini-3.5-flash', entry, 'token-root:superadmin:mfa')).statusCode,
    ).toBe(200);
    await db.recursiveDelete(db.collection(COLLECTIONS.aiModels));
  });

  it('dashboard: el día cerrado se guarda y no se recalcula; hoy va en vivo', async () => {
    const today = utcDay();
    const yesterday = utcDay(new Date(Date.now() - 24 * 3600 * 1000));
    const at = (day: string) => new Date(`${day}T12:00:00.000Z`);
    const order = (id: string, day: string, status: string, totalMinor: number) =>
      db.doc(`orders/${id}`).set({
        status,
        channel: 'families',
        country: 'MX',
        currency: 'MXN',
        amounts: { totalMinor, taxMinor: 0 },
        printRouting: { totalCostUsdMinor: 500 },
        createdAt: at(day),
      });
    await order('o1', yesterday, 'paid', 40000);
    await order('o2', yesterday, 'refunded', 40000);
    await order('o3', today, 'delivered', 20000);
    await db.doc(`aiBudget/${yesterday}`).set({ spentUsdMicros: 2_000_000 });
    for (const [book, orderId, cost] of [
      ['b1', null, 300_000],
      ['b2', null, 500_000],
      ['b1', 'o1', 1_500_000],
    ] as const) {
      await db.collection('aiUsage').add({
        day: yesterday,
        kind: 'illustration',
        provider: 'vertex',
        model: 'gemini-3.1-flash-image',
        costUsdMicros: cost,
        ownerUid: 'u1',
        bookId: book,
        orderId,
        at: at(yesterday),
      });
    }
    const metrics = () =>
      app.inject({ method: 'GET', url: '/v1/admin/metrics?days=2', headers: auth(ADMIN) });
    const first = (await metrics()).json<{
      days: { day: string; final: boolean; orders: number; revenueUsd: number; previews: number }[];
      totals: { orders: number; revenueUsd: number; marginUsd: number };
    }>();
    expect(first.days.map((day) => [day.day, day.final, day.orders])).toEqual([
      [yesterday, true, 1],
      [today, false, 1],
    ]);
    expect(first.days[0]).toMatchObject({ revenueUsd: 20, previews: 2 });
    // 20 + 10 de ingresos; 2 de IA y 5 + 5 de impresión.
    expect(first.totals).toMatchObject({ orders: 2, revenueUsd: 30, marginUsd: 18 });
    expect((await db.doc(`metricsDaily/${yesterday}`).get()).exists).toBe(true);

    // Un cambio posterior en un día cerrado no altera lo guardado (no se recalcula).
    await db.doc('orders/o2').update({ status: 'paid' });
    const second = (await metrics()).json<{ days: { orders: number }[] }>();
    expect(second.days[0]?.orders).toBe(1);

    const costs = (
      await app.inject({ method: 'GET', url: '/v1/admin/ai-costs?days=3', headers: auth(ADMIN) })
    ).json<{ perPreview: { count: number; p50Usd: number }[]; perBook: { avgUsd: number }[] }>();
    expect(costs.perPreview[0]).toMatchObject({ count: 2, p50Usd: 0.3 });
    expect(costs.perBook[0]).toMatchObject({ avgUsd: 1.5 });
  });

  it('un customer no lee ni escribe la configuración', async () => {
    expect((await save('productPricing', 'digital', pricing, 'token-ana')).statusCode).toBe(403);
    const list = await app.inject({
      method: 'GET',
      url: '/v1/admin/config/coupons',
      headers: auth('token-ana'),
    });
    expect(list.statusCode).toBe(403);
  });
});
