import { COLLECTIONS } from '@storynido/shared';
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

  const price = {
    country: 'MX',
    format: 'digital',
    currency: 'MXN',
    amountMinor: 34900,
    proAmountMinor: 31400,
    lengthAdjustmentsMinor: {},
    active: true,
  };

  it('precios: el id es país_formato; crear y actualizar quedan auditados con el antes', async () => {
    const wrong = await save('prices', 'MX_hardcover', price);
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json()).toMatchObject({ error: { message: 'El id tiene que ser "MX_digital".' } });

    expect((await save('prices', 'MX_digital', price)).statusCode).toBe(200);
    expect((await save('prices', 'MX_digital', { ...price, amountMinor: 39900 })).statusCode).toBe(
      200,
    );
    expect((await db.doc('prices/MX_digital').get()).get('amountMinor')).toBe(39900);

    const { entries } = (
      await app.inject({
        method: 'GET',
        url: '/v1/admin/audit-log?entity=prices',
        headers: auth(ADMIN),
      })
    ).json<{
      entries: { action: string; before: { amountMinor?: number; updatedAt?: string } | null }[];
    }>();
    expect(entries.map((entry) => entry.action)).toEqual(['prices.update', 'prices.create']);
    expect(entries[0]?.before?.amountMinor).toBe(34900);
    // Las fechas del antes y el después vuelven como texto ISO.
    expect(entries[0]?.before?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entries[1]?.before).toBeNull();

    const list = await app.inject({
      method: 'GET',
      url: '/v1/admin/config/prices',
      headers: auth(ADMIN),
    });
    expect(list.json()).toMatchObject({
      items: [{ id: 'MX_digital', data: { amountMinor: 39900 } }],
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

  it('un customer no lee ni escribe la configuración', async () => {
    expect((await save('prices', 'MX_digital', price, 'token-ana')).statusCode).toBe(403);
    const list = await app.inject({
      method: 'GET',
      url: '/v1/admin/config/coupons',
      headers: auth('token-ana'),
    });
    expect(list.statusCode).toBe(403);
  });
});
