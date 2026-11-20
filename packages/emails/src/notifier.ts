import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import {
  COLLECTIONS,
  RECEIPT_ORDER_STATUSES,
  type BookFormat,
  type EmailProvider,
  type EmailTemplate,
  type Locale,
  type OrderStatus,
  priceSnapshotSchema,
} from '@storynido/shared';
import type { Firestore } from 'firebase-admin/firestore';

import { EMAIL_DATA, MARKETING_TEMPLATES } from './data';
import { formatLabel } from './copy';
import { RECEIPT_COPY, type ReceiptData } from './receipt';

/** Rutas localizadas de la web (las mismas de next-intl). */
const ORDER_PATH: Record<Locale, string> = { es: 'pedido', en: 'order', pt: 'pedido' };
const CREATE_PATH: Record<Locale, string> = { es: 'crear', en: 'create', pt: 'criar' };

export interface NotifierOptions {
  /** Web pública (enlaces de los mails). */
  webUrl: string;
  /** API pública (enlace de baja). */
  apiUrl: string;
  /** Firma de los enlaces de baja. Sin secreto no se mandan mails de marketing. */
  linkSecret: string | null;
  /** Destinatarios de las alertas internas. */
  adminEmails: readonly string[];
  /** Panel de administración (enlace de las alertas). */
  adminUrl: string;
  log?: { warn: (object: object, message: string) => void };
}

export interface NotifyInput {
  /** Clave idempotente: el mismo mail no sale dos veces (por ejemplo `order:o1:shipped`). */
  key: string;
  template: EmailTemplate;
  /** Destinatario: un usuario (su mail, idioma y preferencias) o una dirección fija. */
  uid?: string | null;
  to?: string | null;
  locale?: Locale;
  data: Record<string, unknown>;
  orderId?: string | null;
  replyTo?: string;
}

export type NotifyOutcome = 'sent' | 'duplicate' | 'skipped' | 'failed';

const RECEIPT_STATUSES = new Set<OrderStatus>(RECEIPT_ORDER_STATUSES);
const PAYMENT_LABELS: Record<string, string> = {
  paypal: 'PayPal',
  gumroad: 'Gumroad',
  dodo: 'Dodo Payments',
  mock: 'Pago de prueba',
};

const LOCK_MS = 5 * 60 * 1000;
const asLocale = (value: unknown): Locale =>
  value === 'en' || value === 'pt' || value === 'es' ? value : 'es';

/**
 * Mails al cliente y al equipo. Cada envío queda en `emailLog/{huella de la clave}`: lo ya
 * enviado no se repite (reintentos, webhooks duplicados) y el admin puede verlo y reenviarlo.
 * Un mail que falla no frena el pedido: queda como `failed` para reintentarlo.
 */
export class EmailNotifier {
  constructor(
    private readonly db: Firestore,
    private readonly provider: () => EmailProvider,
    private readonly options: NotifierOptions,
  ) {}

  private docId(key: string) {
    return createHash('sha256').update(key).digest('hex').slice(0, 40);
  }

  private sign(uid: string) {
    return createHmac('sha256', this.options.linkSecret ?? '')
      .update(`unsubscribe:${uid}`)
      .digest('base64url');
  }

  unsubscribeUrl(uid: string): string | null {
    if (!this.options.linkSecret) return null;
    const params = new URLSearchParams({ u: uid, t: this.sign(uid) });
    return `${this.options.apiUrl}/v1/email/unsubscribe?${params.toString()}`;
  }

  verifyUnsubscribe(uid: string, token: string): boolean {
    if (!this.options.linkSecret) return false;
    const expected = Buffer.from(this.sign(uid));
    const given = Buffer.from(token);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  webUrl(locale: Locale, path = '') {
    return `${this.options.webUrl}/${locale}${path ? `/${path}` : ''}`;
  }

  orderUrl(locale: Locale, orderId: string) {
    return this.webUrl(locale, `${ORDER_PATH[locale]}/${orderId}`);
  }

  createUrl(locale: Locale, bookId?: string) {
    return this.webUrl(locale, bookId ? `${CREATE_PATH[locale]}/${bookId}` : CREATE_PATH[locale]);
  }

  async notify(input: NotifyInput): Promise<NotifyOutcome> {
    const ref = this.db.collection(COLLECTIONS.emailLog).doc(this.docId(input.key));
    const now = new Date();

    // Destinatario, idioma y consentimiento.
    let to = input.to ?? null;
    let locale = input.locale ?? 'es';
    let reason: string | null = null;
    if (input.uid) {
      const user = (await this.db.collection(COLLECTIONS.users).doc(input.uid).get()).data();
      to ??= typeof user?.email === 'string' ? user.email : null;
      locale = input.locale ?? asLocale(user?.locale);
      if (MARKETING_TEMPLATES.has(input.template) && user?.marketingOptIn !== true) {
        reason = 'sin consentimiento de marketing';
      }
    }
    if (!to) reason ??= 'sin destinatario';
    const data = { ...input.data };
    if (MARKETING_TEMPLATES.has(input.template)) {
      const unsubscribeUrl = input.uid ? this.unsubscribeUrl(input.uid) : null;
      if (!unsubscribeUrl) reason ??= 'sin enlace de baja';
      data.unsubscribeUrl = unsubscribeUrl;
    }
    if (!reason) {
      const parsed = EMAIL_DATA[input.template].safeParse(data);
      if (!parsed.success) reason = `datos incompletos: ${parsed.error.issues[0]?.message ?? ''}`;
    }

    // Reserva la clave: si ya salió (o otro proceso lo está mandando), no se repite.
    const claimed = await this.db.runTransaction(async (tx) => {
      const existing = (await tx.get(ref)).data();
      const status = existing?.status as string | undefined;
      const updatedAt = (existing?.updatedAt as { toDate?: () => Date } | undefined)?.toDate?.();
      if (status === 'sent' || status === 'skipped') return false;
      if (status === 'sending' && updatedAt && now.getTime() - updatedAt.getTime() < LOCK_MS) {
        return false;
      }
      tx.set(ref, {
        key: input.key,
        template: input.template,
        uid: input.uid ?? null,
        to,
        locale,
        orderId: input.orderId ?? null,
        // Para reintentar o reenviar desde el admin (fase 15).
        data,
        status: reason ? 'skipped' : 'sending',
        reason,
        attempts: ((existing?.attempts as number | undefined) ?? 0) + (reason ? 0 : 1),
        messageId: null,
        createdAt: (existing?.createdAt as unknown) ?? now,
        updatedAt: now,
        sentAt: null,
      });
      return true;
    });
    if (!claimed) return 'duplicate';
    if (reason || !to) return 'skipped';

    try {
      const { messageId } = await this.provider().send({
        to,
        template: input.template,
        locale,
        data,
        idempotencyKey: input.key,
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      });
      await ref.update({ status: 'sent', messageId, sentAt: new Date(), updatedAt: new Date() });
      return 'sent';
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 300) : 'error';
      await ref.update({ status: 'failed', reason: message, updatedAt: new Date() });
      this.options.log?.warn({ key: input.key, err: message }, 'email failed');
      return 'failed';
    }
  }

  /** Alerta interna al equipo (revisión manual, falla de imprenta o del pipeline). */
  async adminAlert(alert: { key: string; kind: string; orderId: string | null; message: string }) {
    const url = alert.orderId
      ? `${this.options.adminUrl}/orders/${alert.orderId}`
      : this.options.adminUrl;
    const outcomes = await Promise.all(
      this.options.adminEmails.map((to) =>
        this.notify({
          key: `${alert.key}:${to}`,
          template: 'admin_alert',
          to,
          locale: 'es',
          orderId: alert.orderId,
          data: { kind: alert.kind, orderId: alert.orderId, message: alert.message, url },
        }),
      ),
    );
    return outcomes;
  }

  /**
   * Mensaje del formulario de contacto al equipo. Nunca se manda nada a la dirección que
   * escribió la persona (no sirve para spam): "Responder" le contesta.
   */
  async contactMessage(key: string, data: Record<string, unknown> & { email: string }) {
    return Promise.all(
      this.options.adminEmails.map((to) =>
        this.notify({
          key: `${key}:${to}`,
          template: 'contact_message',
          to,
          locale: 'es',
          data,
          replyTo: data.email,
        }),
      ),
    );
  }

  /**
   * Datos del comprobante de compra de un pedido ya pagado (no es una factura). `null` si el
   * pedido no existe, todavía no se pagó o no tiene precio congelado. Con `ownerUid`, solo si
   * el pedido es de esa persona.
   */
  async receiptData(orderId: string, ownerUid?: string): Promise<ReceiptData | null> {
    const order = (await this.db.collection(COLLECTIONS.orders).doc(orderId).get()).data();
    if (!order || (ownerUid && order.ownerUid !== ownerUid)) return null;
    if (!RECEIPT_STATUSES.has(order.status as OrderStatus)) return null;
    // Un precio congelado incompleto no frena nada: el mail sale sin comprobante.
    const parsed = priceSnapshotSchema.safeParse(order.priceSnapshot);
    if (!parsed.success) return null;
    const snapshot = parsed.data;
    const user = (
      await this.db.collection(COLLECTIONS.users).doc(String(order.ownerUid)).get()
    ).data();
    const locale = asLocale(user?.locale ?? order.locale);
    const copy = RECEIPT_COPY[locale];
    const money = (minor: number) => formatMoney(minor, snapshot.currency, locale);
    const items = (order.items ?? []) as { format: BookFormat | 'card'; quantity?: number }[];
    const bookTitle = typeof order.bookTitle === 'string' ? order.bookTitle : 'StoryNido';
    const lines = snapshot.components.map((component) => {
      const isBook = component.code === 'book';
      return {
        description: isBook
          ? bookTitle
          : component.piece
            ? `${copy.lines.piece}: ${copy.pieces[component.piece] ?? component.piece}`
            : copy.lines[component.code === 'book' ? 'piece' : component.code],
        detail: isBook ? formatLabel(locale, items[0]?.format ?? 'digital') : null,
        quantity: component.quantity,
        amount: money(component.totalMinor),
      };
    });
    const payment = (order.payment ?? {}) as { provider?: string; paymentId?: string | null };
    const issued =
      [order.paidAt, order.createdAt]
        .map((value) => (value as { toDate?: () => Date } | undefined)?.toDate?.())
        .find((value) => value instanceof Date) ?? new Date();
    const printed = items.some((item) => item.format !== 'digital');
    return {
      orderId,
      number: `SN-${orderId.slice(0, 8).toUpperCase()}`,
      issuedAt: issued.toISOString(),
      locale,
      customerEmail: typeof user?.email === 'string' ? user.email : null,
      lines: lines.length
        ? lines
        : [
            {
              description: bookTitle,
              detail: null,
              quantity: 1,
              amount: money(snapshot.totalMinor),
            },
          ],
      subtotal: money(snapshot.subtotalMinor),
      discount: snapshot.discount.minor
        ? { label: snapshot.discount.label, amount: money(snapshot.discount.minor) }
        : null,
      shipping: printed && !snapshot.shipping.pending ? money(snapshot.shipping.minor) : null,
      tax: snapshot.tax.minor
        ? { amount: money(snapshot.tax.minor), included: snapshot.tax.included }
        : null,
      total: money(snapshot.totalMinor),
      paymentMethod: PAYMENT_LABELS[payment.provider ?? ''] ?? payment.provider ?? '—',
      paymentRef: payment.paymentId ?? null,
    };
  }

  /**
   * Avisa al cliente del estado del pedido. Una vez por estado (la clave lo garantiza), en su
   * idioma, con los datos del pedido.
   */
  /**
   * Mail del estado del pedido. `resend` (desde el admin) usa otra clave: se vuelve a mandar
   * aunque ya se haya enviado, y queda registrado aparte.
   */
  async orderStatus(
    orderId: string,
    status: OrderStatus,
    options: { resend?: string } = {},
  ): Promise<NotifyOutcome | null> {
    const order = (await this.db.collection(COLLECTIONS.orders).doc(orderId).get()).data();
    if (!order) return null;
    const uid = String(order.ownerUid);
    const user = (await this.db.collection(COLLECTIONS.users).doc(uid).get()).data();
    const locale = asLocale(user?.locale ?? order.locale);
    const items = (order.items ?? []) as { format: BookFormat | 'card' }[];
    const print = items.some((item) => item.format !== 'digital');
    const bookTitle = typeof order.bookTitle === 'string' ? order.bookTitle : 'StoryNido';
    const url = this.orderUrl(locale, orderId);
    const snapshot = order.priceSnapshot as { totalMinor: number; currency: string } | null;
    const total = snapshot ? formatMoney(snapshot.totalMinor, snapshot.currency, locale) : null;
    const base = { uid, orderId };
    const send = (template: EmailTemplate, data: Record<string, unknown>) =>
      this.notify({
        ...base,
        key: `order:${orderId}:${template}${options.resend ? `:resend:${options.resend}` : ''}`,
        template,
        data,
      });

    switch (status) {
      case 'paid': {
        if (!total) return null;
        const receipt = await this.receiptData(orderId);
        return send('payment_confirmed', {
          bookTitle,
          total,
          format: items[0]?.format ?? 'digital',
          url,
          ...(receipt ? { receipt } : {}),
        });
      }
      case 'qa_failed':
        // La revisión manual de un pedido pagado: se le avisa a quien compró, sin prometer plazos.
        return send('order_in_review', { bookTitle, url });
      case 'ready':
        // Un impreso avisa al ir a la imprenta (con el digital ya disponible).
        return print ? null : send('digital_ready', { bookTitle, url });
      case 'sent_to_print': {
        const routing = order.printRouting as { etaDaysMin: number; etaDaysMax: number } | null;
        const shipping = (
          snapshot as { shipping?: { etaDaysMin: number; etaDaysMax: number } } | null
        )?.shipping;
        const eta = routing ?? shipping ?? { etaDaysMin: 5, etaDaysMax: 10 };
        return send('print_sent', {
          bookTitle,
          url,
          etaDaysMin: eta.etaDaysMin,
          etaDaysMax: eta.etaDaysMax,
        });
      }
      case 'in_production':
        return send('print_in_production', { bookTitle, url });
      case 'shipped': {
        const tracking = order.print as {
          trackingNumber: string | null;
          trackingUrl: string | null;
        } | null;
        return send('shipped', {
          bookTitle,
          url,
          trackingNumber: tracking?.trackingNumber ?? null,
          trackingUrl: tracking?.trackingUrl ?? null,
        });
      }
      case 'delivered':
        return send('delivered', { bookTitle, url });
      case 'refunded':
        return total ? send('refunded', { bookTitle, total }) : null;
      case 'cancelled':
        // Un pago que nunca se completó no es un pedido para quien compra: no se avisa.
        return order.payment && (order.payment as { paymentId?: string | null }).paymentId
          ? send('cancelled', { bookTitle })
          : null;
      default:
        return null;
    }
  }
}

export function formatMoney(minor: number, currency: string, locale: Locale) {
  const zeroDecimal = currency === 'CLP' || currency === 'JPY';
  return new Intl.NumberFormat(locale === 'pt' ? 'pt-BR' : locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
  }).format(zeroDecimal ? minor : minor / 100);
}
