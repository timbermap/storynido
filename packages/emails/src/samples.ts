import type { EmailTemplate } from '@storynido/shared';

import type { EmailData } from './data';

const order = 'https://staging.storynido.com/es/pedido/demo';
const unsubscribeUrl = 'https://api.storynido.com/v1/email/unsubscribe?u=demo&t=demo';

/** Datos de ejemplo por plantilla: tests y vista previa local. */
export const SAMPLE_DATA: { [T in EmailTemplate]: EmailData<T> } = {
  welcome: { name: 'Ana', url: 'https://staging.storynido.com/es/crear' },
  preview_ready: {
    childName: 'Martina',
    bookTitle: 'La gran aventura espacial',
    url: 'https://staging.storynido.com/es/crear/demo',
  },
  draft_reminder: {
    childName: 'Martina',
    url: 'https://staging.storynido.com/es/crear/demo',
    unsubscribeUrl,
  },
  payment_confirmed: {
    bookTitle: 'La gran aventura espacial',
    total: 'USD 39.99',
    format: 'softcover',
    url: order,
  },
  digital_ready: { bookTitle: 'La gran aventura espacial', url: order },
  print_sent: { bookTitle: 'La gran aventura espacial', url: order, etaDaysMin: 6, etaDaysMax: 8 },
  print_in_production: { bookTitle: 'La gran aventura espacial', url: order },
  shipped: {
    bookTitle: 'La gran aventura espacial',
    url: order,
    trackingNumber: '9400111899223',
    trackingUrl: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223',
  },
  delivered: { bookTitle: 'La gran aventura espacial', url: order },
  refunded: { bookTitle: 'La gran aventura espacial', total: 'USD 39.99' },
  cancelled: { bookTitle: 'La gran aventura espacial' },
  data_deleted: { scope: 'child' },
  review_request: {
    bookTitle: 'La gran aventura espacial',
    url: 'https://staging.storynido.com/es/opinion/demo',
    unsubscribeUrl,
  },
  new_book_suggestion: {
    childName: 'Martina',
    occasion: 'christmas',
    url: 'https://staging.storynido.com/es/crear',
    unsubscribeUrl,
  },
  admin_alert: {
    kind: 'human_review',
    orderId: 'o-123',
    message: 'El pedido quedó en revisión manual: página 8 sin ilustración aprobada.',
    url: 'https://admin.storynido.com/orders/o-123',
  },
  contact_message: {
    name: 'Laura',
    email: 'laura@example.com',
    topic: 'order',
    message: '¿Puedo cambiar la dirección de envío de mi pedido?',
    locale: 'es',
    page: '/es',
  },
};
