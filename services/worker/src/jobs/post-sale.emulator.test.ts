import { EmailNotifier } from '@storynido/emails';
import { MockEmailProvider } from '@storynido/providers';
import { deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { PostSaleJobs } from './post-sale';

const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-storynido-test' }));
const DAY = 24 * 3600 * 1000;
const now = new Date('2026-12-01T12:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * DAY);

function jobs() {
  const email = new MockEmailProvider();
  const notifier = new EmailNotifier(db, () => email, {
    webUrl: 'https://storynido.test',
    apiUrl: 'https://api.storynido.test',
    linkSecret: 'test-email-link-secret',
    adminEmails: [],
    adminUrl: 'https://admin.storynido.test',
  });
  return { email, run: () => new PostSaleJobs(db, notifier).run(now) };
}

describe('postventa diaria', () => {
  beforeEach(async () => {
    for (const name of ['orders', 'books', 'children', 'users', 'emailLog']) {
      await db.recursiveDelete(db.collection(name));
    }
    await db.doc('users/u1').set({
      email: 'ana@storynido.test',
      locale: 'en',
      country: 'MX',
      marketingOptIn: true,
    });
    await db.doc('children/c1').set({ ownerUid: 'u1', name: 'Martina', createdAt: ago(30) });
  });

  afterAll(async () => {
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  it('reseña a los 7 días, recordatorio de borrador y sugerencia de Navidad, una sola vez', async () => {
    await db.doc('orders/o-print').set({
      ownerUid: 'u1',
      bookTitle: 'La aventura',
      status: 'delivered',
      items: [{ format: 'softcover', quantity: 1 }],
      deliveredAt: ago(8),
    });
    await db.doc('orders/o-new').set({
      ownerUid: 'u1',
      bookTitle: 'Otra',
      status: 'delivered',
      items: [{ format: 'softcover', quantity: 1 }],
      deliveredAt: ago(2),
    });
    await db.doc('books/b-draft').set({
      ownerUid: 'u1',
      childId: 'c1',
      status: 'preview_ready',
      language: 'es',
      updatedAt: ago(2),
    });
    const { email, run } = jobs();
    expect(await run()).toEqual({ reviews: 1, draftReminders: 1, suggestions: 1, retried: 0 });
    expect(email.sent.map((message) => [message.template, message.idempotencyKey])).toEqual(
      expect.arrayContaining([
        ['review_request', 'order:o-print:review_request'],
        ['draft_reminder', 'book:b-draft:draft_reminder'],
        ['new_book_suggestion', 'suggestion:u1:christmas:2026'],
      ]),
    );
    const review = email.sent.find((message) => message.template === 'review_request');
    expect(review?.locale).toBe('en');
    expect(review?.data.url).toBe('https://storynido.test/en/order/o-print#opinion');
    expect(String(review?.data.unsubscribeUrl)).toContain('/v1/email/unsubscribe?u=u1');
    // Si corre de nuevo el mismo día, no repite nada.
    expect(await run()).toEqual({ reviews: 0, draftReminders: 0, suggestions: 0, retried: 0 });
  });

  it('sin consentimiento de marketing no se manda nada de postventa', async () => {
    await db.doc('users/u1').update({ marketingOptIn: false });
    await db.doc('orders/o-print').set({
      ownerUid: 'u1',
      bookTitle: 'La aventura',
      status: 'delivered',
      items: [{ format: 'softcover', quantity: 1 }],
      deliveredAt: ago(8),
    });
    const { email, run } = jobs();
    await run();
    expect(email.sent).toEqual([]);
    const log = await db.collection('emailLog').get();
    expect(
      log.docs.map((doc) => [doc.get('status') as unknown, doc.get('reason') as unknown]),
    ).toEqual(expect.arrayContaining([['skipped', 'sin consentimiento de marketing']]));
  });

  it('un mail que falló se reintenta (hasta 3 intentos)', async () => {
    const { email, run } = jobs();
    await db
      .collection('emailLog')
      .doc('x')
      .set({
        key: 'order:o9:delivered',
        template: 'delivered',
        uid: 'u1',
        to: 'ana@storynido.test',
        locale: 'es',
        orderId: 'o9',
        data: { bookTitle: 'La aventura', url: 'https://storynido.test/es/pedido/o9' },
        status: 'failed',
        attempts: 1,
      });
    // La clave del registro es la huella de la clave del mail: se reintenta con la misma.
    expect((await run()).retried).toBe(1);
    expect(email.sent.map((message) => message.idempotencyKey)).toEqual(['order:o9:delivered']);
  });
});
