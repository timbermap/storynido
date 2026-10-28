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
    for (const name of [COLLECTIONS.siteConfig, COLLECTIONS.auditLog]) {
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
});
