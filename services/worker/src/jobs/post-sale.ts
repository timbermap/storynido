import type { EmailNotifier, NotifyOutcome } from '@storynido/emails';
import { COLLECTIONS, type CountryCode, type EmailTemplate, type Locale } from '@storynido/shared';
import type { Firestore } from 'firebase-admin/firestore';

const DAY = 24 * 3600 * 1000;

/** Fechas en las que se sugiere un libro nuevo (con dos semanas de anticipación). */
export const OCCASIONS: readonly {
  id: 'christmas' | 'childrens_day';
  /** Día de envío (mes 1–12, día). */
  send: { month: number; day: number };
  /** Países donde aplica; null: todos. */
  countries: readonly CountryCode[] | null;
}[] = [
  { id: 'christmas', send: { month: 12, day: 1 }, countries: null },
  // Día del Niño en México: 30 de abril.
  { id: 'childrens_day', send: { month: 4, day: 16 }, countries: ['MX'] },
];

type Timestampish = { toDate(): Date } | Date | null | undefined;
const asDate = (value: Timestampish) =>
  value instanceof Date ? value : value ? value.toDate() : null;
const asLocale = (value: unknown): Locale =>
  value === 'en' || value === 'pt' || value === 'es' ? value : 'es';

export interface PostSaleReport {
  reviews: number;
  draftReminders: number;
  suggestions: number;
  retried: number;
}

/**
 * Postventa (Cloud Scheduler la dispara una vez por día). Todo es idempotente: si corre dos
 * veces el mismo día, la clave de cada mail evita repetirlo. Los mails de marketing respetan la
 * baja y el consentimiento (lo controla el notificador).
 */
export class PostSaleJobs {
  constructor(
    private readonly db: Firestore,
    private readonly notifier: EmailNotifier,
  ) {}

  async run(now = new Date()): Promise<PostSaleReport> {
    const [reviews, draftReminders, suggestions, retried] = await Promise.all([
      this.reviews(now),
      this.draftReminders(now),
      this.suggestions(now),
      this.retryFailed(),
    ]);
    return { reviews, draftReminders, suggestions, retried };
  }

  private count(outcomes: NotifyOutcome[]) {
    return outcomes.filter((outcome) => outcome === 'sent').length;
  }

  /** Pedido de reseña a los 7 días de entregado (el digital, desde que quedó listo). */
  private async reviews(now: Date) {
    const from = now.getTime() - 14 * DAY;
    const to = now.getTime() - 7 * DAY;
    const orders = await this.db
      .collection(COLLECTIONS.orders)
      .where('status', 'in', ['delivered', 'ready'])
      .get();
    const outcomes: NotifyOutcome[] = [];
    for (const doc of orders.docs) {
      const order = doc.data();
      const items = (order.items ?? []) as { format: string }[];
      const digitalOnly = items.every((item) => item.format === 'digital');
      if (order.status === 'ready' && !digitalOnly) continue;
      const at = asDate(
        (order.status === 'delivered'
          ? order.deliveredAt
          : (order.pipeline as { finishedAt?: Timestampish } | undefined)
              ?.finishedAt) as Timestampish,
      );
      if (!at || at.getTime() < from || at.getTime() > to) continue;
      const uid = String(order.ownerUid);
      const user = (await this.db.collection(COLLECTIONS.users).doc(uid).get()).data();
      const locale = asLocale(user?.locale);
      outcomes.push(
        await this.notifier.notify({
          key: `order:${doc.id}:review_request`,
          template: 'review_request',
          uid,
          orderId: doc.id,
          data: {
            bookTitle: typeof order.bookTitle === 'string' ? order.bookTitle : 'StoryNido',
            url: `${this.notifier.orderUrl(locale, doc.id)}#opinion`,
          },
        }),
      );
    }
    return this.count(outcomes);
  }

  /** Muestra lista sin comprar: un recordatorio entre 1 y 3 días después. */
  private async draftReminders(now: Date) {
    const from = now.getTime() - 3 * DAY;
    const to = now.getTime() - DAY;
    const books = await this.db
      .collection(COLLECTIONS.books)
      .where('status', '==', 'preview_ready')
      .get();
    const outcomes: NotifyOutcome[] = [];
    for (const doc of books.docs) {
      const book = doc.data();
      const updated = asDate(book.updatedAt as Timestampish);
      if (!updated || updated.getTime() < from || updated.getTime() > to) continue;
      const childId = typeof book.childId === 'string' ? book.childId : null;
      const child = childId
        ? (await this.db.collection(COLLECTIONS.children).doc(childId).get()).data()
        : undefined;
      if (typeof child?.name !== 'string') continue;
      outcomes.push(
        await this.notifier.notify({
          key: `book:${doc.id}:draft_reminder`,
          template: 'draft_reminder',
          uid: String(book.ownerUid),
          data: {
            childName: child.name,
            url: this.notifier.createUrl(asLocale(book.language), doc.id),
          },
        }),
      );
    }
    return this.count(outcomes);
  }

  /** Sugerencia de un libro nuevo en fechas clave, a quien ya compró y aceptó novedades. */
  private async suggestions(now: Date) {
    const today = OCCASIONS.filter(
      (occasion) =>
        occasion.send.month === now.getUTCMonth() + 1 && occasion.send.day === now.getUTCDate(),
    );
    if (today.length === 0) return 0;
    const users = await this.db
      .collection(COLLECTIONS.users)
      .where('marketingOptIn', '==', true)
      .get();
    const outcomes: NotifyOutcome[] = [];
    for (const occasion of today) {
      for (const doc of users.docs) {
        const user = doc.data();
        const country = user.country as CountryCode | null | undefined;
        if (occasion.countries && (!country || !occasion.countries.includes(country))) continue;
        const bought = await this.db
          .collection(COLLECTIONS.orders)
          .where('ownerUid', '==', doc.id)
          .where('status', 'in', [
            'ready',
            'sent_to_print',
            'in_production',
            'shipped',
            'delivered',
          ])
          .limit(1)
          .get();
        if (bought.empty) continue;
        const children = await this.db
          .collection(COLLECTIONS.children)
          .where('ownerUid', '==', doc.id)
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();
        const childName = children.docs[0]?.get('name') as string | undefined;
        outcomes.push(
          await this.notifier.notify({
            key: `suggestion:${doc.id}:${occasion.id}:${String(now.getUTCFullYear())}`,
            template: 'new_book_suggestion',
            uid: doc.id,
            data: {
              childName: childName ?? null,
              occasion: occasion.id,
              url: this.notifier.createUrl(asLocale(user.locale)),
            },
          }),
        );
      }
    }
    return this.count(outcomes);
  }

  /** Mails que fallaron (proveedor caído): hasta 3 intentos en total. */
  private async retryFailed() {
    const failed = await this.db
      .collection(COLLECTIONS.emailLog)
      .where('status', '==', 'failed')
      .limit(100)
      .get();
    const outcomes: NotifyOutcome[] = [];
    for (const doc of failed.docs) {
      const log = doc.data();
      if (((log.attempts as number | undefined) ?? 0) >= 3) continue;
      outcomes.push(
        await this.notifier.notify({
          key: String(log.key),
          template: log.template as EmailTemplate,
          uid: (log.uid as string | null) ?? null,
          to: (log.to as string | null) ?? null,
          locale: asLocale(log.locale),
          orderId: (log.orderId as string | null) ?? null,
          data: (log.data as Record<string, unknown> | undefined) ?? {},
        }),
      );
    }
    return this.count(outcomes);
  }
}
