import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import {
  COLLECTIONS,
  type BookFormat,
  type EmailProvider,
  type EmailTemplate,
  type Locale,
  type OrderStatus,
} from '@storynido/shared';
import type { Firestore } from 'firebase-admin/firestore';

import { EMAIL_DATA, MARKETING_TEMPLATES } from './data';

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
}

export type NotifyOutcome = 'sent' | 'duplicate' | 'skipped' | 'failed';

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
   * Avisa al cliente del estado del pedido. Una vez por estado (la clave lo garantiza), en su
   * idioma, con los datos del pedido.
   */
  async orderStatus(orderId: string, status: OrderStatus): Promise<NotifyOutcome | null> {
    const order = (await this.db.collection(COLLECTIONS.orders).doc(orderId).get()).data();
    if (!order) return null;
    const uid = String(order.ownerUid);
    const user = (await this.db.collection(COLLECTIONS.users).doc(uid).get()).data();
    const locale = asLocale(user?.locale ?? order.locale);
    const items = (order.items ?? []) as { format: BookFormat }[];
    const print = items.some((item) => item.format !== 'digital');
    const bookTitle = typeof order.bookTitle === 'string' ? order.bookTitle : 'StoryNido';
    const url = this.orderUrl(locale, orderId);
    const snapshot = order.priceSnapshot as { totalMinor: number; currency: string } | null;
    const total = snapshot ? formatMoney(snapshot.totalMinor, snapshot.currency, locale) : null;
    const base = { uid, orderId };
    const send = (template: EmailTemplate, data: Record<string, unknown>) =>
      this.notify({ ...base, key: `order:${orderId}:${template}`, template, data });

    switch (status) {
      case 'paid':
        return total
          ? send('payment_confirmed', {
              bookTitle,
              total,
              format: items[0]?.format ?? 'digital',
              url,
            })
          : null;
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
