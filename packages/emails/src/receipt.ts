import { readFileSync } from 'node:fs';

import fontkit from '@pdf-lib/fontkit';
import { LOCALES, type Locale } from '@storynido/shared';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { z } from 'zod';

import { DEFAULT_BRAND, type EmailBrand } from './brand';

/**
 * Comprobante de compra en PDF. NO es una factura ni un documento fiscal: así lo dice el propio
 * documento. Los importes llegan ya formateados (moneda y decimales del idioma) para que el PDF
 * no decida nada de plata. Sin CUIT, razón social ni números fiscales hasta que exista la
 * sociedad que factura (DECISIONS 296).
 */
export const receiptSchema = z.object({
  orderId: z.string().min(1),
  /** Número corto que ve el cliente (por ejemplo `SN-3F9K2LQA`). */
  number: z.string().min(1),
  /** Fecha del pago, ISO. */
  issuedAt: z.string().min(1),
  locale: z.enum(LOCALES),
  customerEmail: z.string().nullable(),
  lines: z
    .array(
      z.object({
        description: z.string().min(1),
        detail: z.string().nullable(),
        quantity: z.number().int().positive(),
        amount: z.string().min(1),
      }),
    )
    .min(1),
  subtotal: z.string().min(1),
  discount: z.object({ label: z.string().nullable(), amount: z.string().min(1) }).nullable(),
  /** `null` cuando no hay envío en este pedido (digital). */
  shipping: z.string().nullable(),
  tax: z.object({ amount: z.string().min(1), included: z.boolean() }).nullable(),
  total: z.string().min(1),
  paymentMethod: z.string().min(1),
  paymentRef: z.string().nullable(),
});

export type ReceiptData = z.infer<typeof receiptSchema>;

export interface ReceiptCopy {
  title: string;
  number: string;
  date: string;
  email: string;
  payment: string;
  reference: string;
  item: string;
  qty: string;
  amount: string;
  subtotal: string;
  discount: string;
  shipping: string;
  shippingFree: string;
  taxIncluded: string;
  tax: string;
  total: string;
  notInvoiceTitle: string;
  notInvoice: string;
  thanks: string;
  tagline: string;
  filename: string;
  /** Descripciones de las líneas del pedido. */
  lines: { copy: string; cards: string; length: string; design: string; piece: string };
  pieces: Record<string, string>;
}

export const RECEIPT_COPY: Record<Locale, ReceiptCopy> = {
  es: {
    title: 'Comprobante de compra',
    number: 'Pedido',
    date: 'Fecha',
    email: 'Enviado a',
    payment: 'Medio de pago',
    reference: 'Referencia del pago',
    item: 'Detalle',
    qty: 'Cant.',
    amount: 'Importe',
    subtotal: 'Subtotal',
    discount: 'Descuento',
    shipping: 'Envío',
    shippingFree: 'Sin costo',
    taxIncluded: 'Impuestos incluidos en el precio',
    tax: 'Impuestos',
    total: 'Total pagado',
    notInvoiceTitle: 'Este comprobante no es una factura',
    notInvoice:
      'Es la constancia de tu compra en StoryNido y no tiene validez fiscal. Si necesitas una factura, escríbenos desde el contacto de storynido.com con el número de pedido.',
    thanks: 'Gracias por elegir StoryNido.',
    tagline: 'Historias que inspiran, enseñan y quedan para siempre.',
    filename: 'comprobante-storynido',
    lines: {
      copy: 'Ejemplares adicionales',
      cards: 'Tarjetas impresas',
      length: 'Extensión del cuento',
      design: 'Diseño del kit',
      piece: 'Pieza del kit',
    },
    pieces: {
      mini_book: 'Librito',
      activities: 'Actividades',
      invitation: 'Invitación',
      thank_you: 'Tarjeta de gracias',
      stickers: 'Stickers',
      favor_tags: 'Etiquetas de souvenir',
    },
  },
  en: {
    title: 'Purchase receipt',
    number: 'Order',
    date: 'Date',
    email: 'Sent to',
    payment: 'Payment method',
    reference: 'Payment reference',
    item: 'Details',
    qty: 'Qty',
    amount: 'Amount',
    subtotal: 'Subtotal',
    discount: 'Discount',
    shipping: 'Shipping',
    shippingFree: 'Free',
    taxIncluded: 'Taxes included in the price',
    tax: 'Taxes',
    total: 'Total paid',
    notInvoiceTitle: 'This receipt is not an invoice',
    notInvoice:
      'It is proof of your purchase at StoryNido and has no tax validity. If you need an invoice, write to us from the contact page at storynido.com with your order number.',
    thanks: 'Thank you for choosing StoryNido.',
    tagline: 'Stories that inspire, teach and last forever.',
    filename: 'storynido-receipt',
    lines: {
      copy: 'Additional copies',
      cards: 'Printed cards',
      length: 'Story length',
      design: 'Kit design',
      piece: 'Kit piece',
    },
    pieces: {
      mini_book: 'Mini book',
      activities: 'Activities',
      invitation: 'Invitation',
      thank_you: 'Thank-you card',
      stickers: 'Stickers',
      favor_tags: 'Favor tags',
    },
  },
  pt: {
    title: 'Comprovante de compra',
    number: 'Pedido',
    date: 'Data',
    email: 'Enviado para',
    payment: 'Forma de pagamento',
    reference: 'Referência do pagamento',
    item: 'Detalhe',
    qty: 'Qtd.',
    amount: 'Valor',
    subtotal: 'Subtotal',
    discount: 'Desconto',
    shipping: 'Frete',
    shippingFree: 'Sem custo',
    taxIncluded: 'Impostos incluídos no preço',
    tax: 'Impostos',
    total: 'Total pago',
    notInvoiceTitle: 'Este comprovante não é uma nota fiscal',
    notInvoice:
      'É a comprovação da sua compra na StoryNido e não tem validade fiscal. Se precisar de uma nota fiscal, escreva para nós pelo contato em storynido.com com o número do pedido.',
    thanks: 'Obrigado por escolher a StoryNido.',
    tagline: 'Histórias que inspiram, ensinam e ficam para sempre.',
    filename: 'comprovante-storynido',
    lines: {
      copy: 'Exemplares adicionais',
      cards: 'Cartões impressos',
      length: 'Extensão da história',
      design: 'Design do kit',
      piece: 'Peça do kit',
    },
    pieces: {
      mini_book: 'Livrinho',
      activities: 'Atividades',
      invitation: 'Convite',
      thank_you: 'Cartão de agradecimento',
      stickers: 'Adesivos',
      favor_tags: 'Tags de lembrancinha',
    },
  },
};

/** Nombre del archivo adjunto o descargado. */
export function receiptFilename(data: Pick<ReceiptData, 'locale' | 'number'>): string {
  return `${RECEIPT_COPY[data.locale].filename}-${data.number}.pdf`;
}

// Marca v3 (docs/BRAND.md).
const NAVY = rgb(0x26 / 255, 0x32 / 255, 0x4a / 255);
const MUTED = rgb(0x55 / 255, 0x5c / 255, 0x6e / 255);
const PEACH = rgb(0xff / 255, 0xb6 / 255, 0xa7 / 255);
const SAGE = rgb(0x8a / 255, 0xc8 / 255, 0xbc / 255);
const CREAM = rgb(0xff / 255, 0xf8 / 255, 0xf1 / 255);
const BORDER = rgb(0xef / 255, 0xe3 / 255, 0xd8 / 255);
const CORAL = rgb(0xa3 / 255, 0x3f / 255, 0x33 / 255);

const HEART =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

let fontFiles: Record<'quicksandMedium' | 'quicksandBold' | 'lora' | 'caveat', Uint8Array> | null =
  null;
function loadFonts() {
  const read = (name: string) =>
    new Uint8Array(readFileSync(new URL(`../assets/fonts/${name}`, import.meta.url)));
  fontFiles ??= {
    quicksandMedium: read('Quicksand-Medium.ttf'),
    quicksandBold: read('Quicksand-Bold.ttf'),
    lora: read('Lora-Regular.ttf'),
    caveat: read('Caveat-SemiBold.ttf'),
  };
  return fontFiles;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function formatDate(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === 'pt' ? 'pt-BR' : locale, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(date);
}

/** Dibuja el PDF A4 del comprobante: una sola página, con la marca de StoryNido. */
export async function renderReceiptPdf(
  input: ReceiptData,
  brand: EmailBrand = DEFAULT_BRAND,
): Promise<Uint8Array> {
  const data = receiptSchema.parse(input);
  const copy = RECEIPT_COPY[data.locale];
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const files = loadFonts();
  const [medium, bold, serif, hand] = await Promise.all([
    doc.embedFont(files.quicksandMedium, { subset: true }),
    doc.embedFont(files.quicksandBold, { subset: true }),
    doc.embedFont(files.lora, { subset: true }),
    doc.embedFont(files.caveat, { subset: true }),
  ]);
  doc.setTitle(`${copy.title} ${data.number}`);
  doc.setAuthor(brand.name);
  doc.setSubject(copy.title);
  doc.setProducer(brand.name);
  doc.setCreator(brand.name);

  const W = 595.28;
  const H = 841.89;
  const M = 48;
  const page = doc.addPage([W, H]);
  const text = (
    value: string,
    x: number,
    y: number,
    font: PDFFont,
    size: number,
    color = NAVY,
    align: 'left' | 'right' = 'left',
  ) => {
    const width = font.widthOfTextAtSize(value, size);
    page.drawText(value, { x: align === 'right' ? x - width : x, y, font, size, color });
  };
  const heart = (x: number, y: number, size: number, color: typeof PEACH) => {
    page.drawSvgPath(HEART, { x, y: y + size, scale: size / 24, color });
  };

  // Banda superior con el durazno de la marca y el logo.
  page.drawRectangle({ x: 0, y: H - 14, width: W, height: 14, color: PEACH });
  let y = H - 64;
  text(brand.name, M, y, bold, 24);
  const logoEnd = M + bold.widthOfTextAtSize(brand.name, 24);
  heart(logoEnd + 6, y + 8, 13, PEACH);
  heart(logoEnd + 19, y + 2, 10, SAGE);
  text(brand.siteUrl.replace(/^https?:\/\//, ''), W - M, y, medium, 10, MUTED, 'right');

  // Título.
  y -= 48;
  text(copy.title, M, y, bold, 26);
  y -= 26;
  text(`${copy.number} ${data.number}`, M, y, medium, 13, CORAL);

  // Datos del pedido.
  y -= 34;
  const meta: [string, string][] = [
    [copy.date, formatDate(data.issuedAt, data.locale)],
    [copy.payment, data.paymentMethod],
    ...(data.customerEmail ? [[copy.email, data.customerEmail] as [string, string]] : []),
    ...(data.paymentRef ? [[copy.reference, data.paymentRef] as [string, string]] : []),
  ];
  const metaHeight = meta.length * 20 + 20;
  page.drawRectangle({
    x: M,
    y: y - metaHeight + 12,
    width: W - 2 * M,
    height: metaHeight,
    color: CREAM,
    borderColor: BORDER,
    borderWidth: 1,
  });
  let my = y - 8;
  for (const [label, value] of meta) {
    text(label, M + 16, my, medium, 10, MUTED);
    text(value, M + 150, my, bold, 11);
    my -= 20;
  }
  y -= metaHeight + 24;

  // Tabla de líneas.
  const colQty = W - M - 110;
  const colAmount = W - M;
  text(copy.item, M, y, bold, 10, MUTED);
  text(copy.qty, colQty, y, bold, 10, MUTED, 'right');
  text(copy.amount, colAmount, y, bold, 10, MUTED, 'right');
  y -= 8;
  page.drawLine({
    start: { x: M, y },
    end: { x: W - M, y },
    thickness: 1,
    color: BORDER,
  });
  y -= 22;
  for (const line of data.lines) {
    const titleLines = wrap(line.description, bold, 12, colQty - M - 50);
    for (const part of titleLines) {
      text(part, M, y, bold, 12);
      y -= 16;
    }
    y += 16;
    text(String(line.quantity), colQty, y, medium, 12, NAVY, 'right');
    text(line.amount, colAmount, y, bold, 12, NAVY, 'right');
    y -= 16 * (titleLines.length - 1);
    if (line.detail) {
      y -= 16;
      text(line.detail, M, y, serif, 10, MUTED);
    }
    y -= 14;
    page.drawLine({
      start: { x: M, y },
      end: { x: W - M, y },
      thickness: 0.5,
      color: BORDER,
    });
    y -= 20;
  }

  // Totales.
  const totals: [string, string][] = [[copy.subtotal, data.subtotal]];
  if (data.discount) {
    totals.push([
      data.discount.label ? `${copy.discount} (${data.discount.label})` : copy.discount,
      `-${data.discount.amount}`,
    ]);
  }
  if (data.shipping !== null) totals.push([copy.shipping, data.shipping]);
  // Sin descuento ni envío, el subtotal repite el total: no se muestra.
  if (totals.length === 1 && data.subtotal === data.total) totals.length = 0;
  for (const [label, value] of totals) {
    text(label, colQty - 90, y, medium, 11, MUTED);
    text(value, colAmount, y, medium, 11, NAVY, 'right');
    y -= 20;
  }
  if (data.tax?.included) {
    text(`${copy.taxIncluded}: ${data.tax.amount}`, colAmount, y, medium, 9, MUTED, 'right');
    y -= 20;
  } else if (data.tax) {
    text(copy.tax, colQty - 90, y, medium, 11, MUTED);
    text(data.tax.amount, colAmount, y, medium, 11, NAVY, 'right');
    y -= 20;
  }
  y -= 4;
  page.drawRectangle({
    x: colQty - 110,
    y: y - 14,
    width: colAmount - colQty + 110,
    height: 38,
    color: PEACH,
  });
  text(copy.total, colQty - 98, y - 2, bold, 13);
  text(data.total, colAmount - 12, y - 2, bold, 15, NAVY, 'right');
  y -= 70;

  // Aviso discreto: no es una factura (línea chica y gris, pegada al pie).
  const noticeLines = wrap(`${copy.notInvoiceTitle}. ${copy.notInvoice}`, medium, 7.5, W - 2 * M);
  let ny = 108 + (noticeLines.length - 1) * 10;
  for (const part of noticeLines) {
    text(part, M, ny, medium, 7.5, MUTED);
    ny -= 10;
  }

  footer(page, { W, M, copy, brand, hand, medium, text, heart });
  return doc.save();
}

function footer(
  page: PDFPage,
  o: {
    W: number;
    M: number;
    copy: ReceiptCopy;
    brand: EmailBrand;
    hand: PDFFont;
    medium: PDFFont;
    text: (
      value: string,
      x: number,
      y: number,
      font: PDFFont,
      size: number,
      color?: ReturnType<typeof rgb>,
      align?: 'left' | 'right',
    ) => void;
    heart: (x: number, y: number, size: number, color: typeof PEACH) => void;
  },
) {
  const { W, M, copy, brand } = o;
  page.drawLine({
    start: { x: M, y: 92 },
    end: { x: W - M, y: 92 },
    thickness: 0.5,
    color: BORDER,
  });
  o.text(copy.thanks, M, 66, o.medium, 11);
  o.text(copy.tagline, M, 44, o.hand, 15, CORAL);
  o.heart(W - M - 34, 56, 12, PEACH);
  o.heart(W - M - 18, 50, 10, SAGE);
  o.text(brand.siteUrl.replace(/^https?:\/\//, ''), W - M, 30, o.medium, 9, MUTED, 'right');
}
