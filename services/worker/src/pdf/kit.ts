import type { KitPiece, PaperSize } from '@storynido/shared';

import { fontFaces } from './fonts';
import { mazeSvg } from './maze';

/**
 * Piezas del kit de cumpleaños (fase 12b). Se arman con la portada y las ilustraciones del
 * librito ya aprobado: ninguna pieza vuelve a usar IA. Se imprimen en casa o en una imprenta
 * local: tamaño real, marcas de corte y la licencia de copias en cada hoja.
 */

export type KitLang = 'es' | 'en' | 'pt';

export interface KitBook {
  language: KitLang;
  childName: string;
  title: string;
  turningAge: number | null;
  /** Fecha del evento (AAAA-MM-DD). */
  eventDate: string | null;
  invitation: { time: string | null; place: string | null } | null;
  /** Portada aprobada (data URI). */
  cover: string;
  paper: PaperSize;
}

export const PAPER_MM: Record<PaperSize, { width: number; height: number }> = {
  letter: { width: 215.9, height: 279.4 },
  a4: { width: 210, height: 297 },
};

/** Tarjeta 5×7" (127×178 mm), el tamaño más común para invitaciones. */
const CARD = { width: 127, height: 178 } as const;
const BLEED = 3;
const INK = '#342a40';
const LAVENDER = '#79518c';
const PAPER = '#fffaf3';

const STRINGS: Record<KitLang, Record<string, string>> = {
  es: {
    invite: '¡Te invito a mi cumple!',
    turning: '¡{name} cumple {age}!',
    birthday: '¡Es el cumple de {name}!',
    when: 'Cuándo',
    time: 'Hora',
    where: 'Dónde',
    waiting: '¡Te esperamos!',
    thanks: '¡Gracias por venir a mi cumple!',
    love: 'Con cariño, {name}',
    tag: '¡Gracias por venir!',
    years: '¡{age} años!',
    activities: 'Actividades del cumple de {name}',
    maze: 'Ayuda a {name} a llegar a la torta',
    draw: 'Dibuja tu torta de cumpleaños',
    drawHint: '¿Cuántas velas tiene? ¿De qué sabor es?',
    match: 'Une cada palabra con su dibujo',
    words: 'torta · globo · regalo · vela',
    license: 'Licencia StoryNido: {copies} copias para el cumpleaños de {name}.',
    cut: 'Recortar por las marcas',
  },
  en: {
    invite: 'You’re invited to my party!',
    turning: '{name} is turning {age}!',
    birthday: 'It’s {name}’s birthday!',
    when: 'When',
    time: 'Time',
    where: 'Where',
    waiting: 'See you there!',
    thanks: 'Thank you for coming to my party!',
    love: 'Love, {name}',
    tag: 'Thanks for coming!',
    years: '{age} years old!',
    activities: '{name}’s birthday activities',
    maze: 'Help {name} get to the cake',
    draw: 'Draw your birthday cake',
    drawHint: 'How many candles? What flavor?',
    match: 'Match each word with its picture',
    words: 'cake · balloon · gift · candle',
    license: 'StoryNido license: {copies} copies for {name}’s birthday.',
    cut: 'Cut along the marks',
  },
  pt: {
    invite: 'Venha para o meu aniversário!',
    turning: '{name} vai fazer {age}!',
    birthday: 'É o aniversário de {name}!',
    when: 'Quando',
    time: 'Hora',
    where: 'Onde',
    waiting: 'Esperamos você!',
    thanks: 'Obrigado por vir ao meu aniversário!',
    love: 'Com carinho, {name}',
    tag: 'Obrigado por vir!',
    years: '{age} anos!',
    activities: 'Atividades do aniversário de {name}',
    maze: 'Ajude {name} a chegar ao bolo',
    draw: 'Desenhe o seu bolo de aniversário',
    drawHint: 'Quantas velas? De que sabor?',
    match: 'Ligue cada palavra ao desenho',
    words: 'bolo · balão · presente · vela',
    license: 'Licença StoryNido: {copies} cópias para o aniversário de {name}.',
    cut: 'Recortar pelas marcas',
  },
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function t(book: KitBook, key: string, extra: Record<string, string | number> = {}) {
  let value = STRINGS[book.language][key] ?? key;
  for (const [name, replacement] of Object.entries({
    name: book.childName,
    age: book.turningAge ?? '',
    ...extra,
  })) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return escapeHtml(value);
}

function formatDate(book: KitBook) {
  if (!book.eventDate) return null;
  const locale = book.language === 'pt' ? 'pt-BR' : book.language;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' }).format(
    new Date(`${book.eventDate}T00:00:00Z`),
  );
}

function kitDocument(size: { width: number; height: number }, css: string, pages: string[]) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces()}
@page { size: ${String(size.width)}mm ${String(size.height)}mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Nunito Sans', sans-serif; color: ${INK}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: ${String(size.width)}mm; height: ${String(size.height)}mm; position: relative; overflow: hidden; break-after: page; background: #fff; }
.page:last-child { break-after: auto; }
.display { font-family: 'Fraunces', serif; font-weight: 600; letter-spacing: -0.02em; line-height: 1.05; }
.license { position: absolute; left: 0; right: 0; bottom: 6mm; text-align: center; font-size: 7.5pt; color: #8a8090; }
${css}
</style></head><body>${pages.join('\n')}<script>document.fonts.ready.then(() => { window.__fitted = true; });</script></body></html>`;
}

/** Marcas de corte en las esquinas de un rectángulo (fuera del área que se recorta). */
function cropMarks(x: number, y: number, width: number, height: number) {
  const len = 6;
  const gap = 2;
  const lines: string[] = [];
  for (const [cx, cy, dx, dy] of [
    [x, y, -1, -1],
    [x + width, y, 1, -1],
    [x, y + height, -1, 1],
    [x + width, y + height, 1, 1],
  ] as const) {
    lines.push(
      `<line x1="${String(cx + dx * gap)}" y1="${String(cy)}" x2="${String(cx + dx * (gap + len))}" y2="${String(cy)}"/>`,
      `<line x1="${String(cx)}" y1="${String(cy + dy * gap)}" x2="${String(cx)}" y2="${String(cy + dy * (gap + len))}"/>`,
    );
  }
  return lines.join('');
}

function cardSheet(book: KitBook, copies: number, front: string, back: string) {
  const paper = PAPER_MM[book.paper];
  const x = (paper.width - CARD.width) / 2;
  const y = (paper.height - CARD.height) / 2;
  const sheet = (content: string) => `<section class="page" data-label="tarjeta">
  <div class="card" style="left:${String(x - BLEED)}mm;top:${String(y - BLEED)}mm">${content}</div>
  <svg class="marks" viewBox="0 0 ${String(paper.width)} ${String(paper.height)}">${cropMarks(x, y, CARD.width, CARD.height)}</svg>
  <p class="license">${t(book, 'license', { copies })} · ${t(book, 'cut')}</p>
</section>`;
  const css = `
.card { position: absolute; width: ${String(CARD.width + 2 * BLEED)}mm; height: ${String(CARD.height + 2 * BLEED)}mm; overflow: hidden; background: ${PAPER}; }
.card .art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.card .band { position: absolute; left: 0; right: 0; bottom: 0; padding: 8mm 10mm 12mm; background: linear-gradient(to top, rgba(255,250,243,0.97) 70%, rgba(255,250,243,0)); text-align: center; }
.card .band h1 { font-size: 24pt; color: ${INK}; }
.card .band p { margin-top: 2mm; font-size: 12pt; color: ${LAVENDER}; font-weight: 700; }
.card .back { position: absolute; inset: ${String(BLEED + 10)}mm; display: flex; flex-direction: column; justify-content: center; gap: 6mm; text-align: center; }
.card .back h2 { font-size: 22pt; color: ${LAVENDER}; }
.card .row { font-size: 12pt; }
.card .row b { display: block; font-size: 9pt; letter-spacing: 0.12em; text-transform: uppercase; color: #8a8090; }
.card .line { display: block; margin: 2mm auto 0; width: 70%; border-bottom: 0.4mm solid #c9bfcf; height: 6mm; }
.marks { position: absolute; inset: 0; width: 100%; height: 100%; }
.marks line { stroke: #000; stroke-width: 0.25; }`;
  return { css, pages: [sheet(front), sheet(back)] };
}

function invitation(book: KitBook, copies: number) {
  const date = formatDate(book);
  const field = (label: string, value: string | null | undefined) =>
    `<p class="row"><b>${t(book, label)}</b>${value ? escapeHtml(value) : '<span class="line"></span>'}</p>`;
  return cardSheet(
    book,
    copies,
    `<img class="art" src="${book.cover}" alt=""><div class="band"><h1 class="display">${book.turningAge ? t(book, 'turning') : t(book, 'birthday')}</h1><p>${t(book, 'invite')}</p></div>`,
    `<div class="back"><h2 class="display">${t(book, 'invite')}</h2>${field('when', date)}${field('time', book.invitation?.time)}${field('where', book.invitation?.place)}<p class="row">${t(book, 'waiting')}</p></div>`,
  );
}

function thankYou(book: KitBook, copies: number) {
  return cardSheet(
    book,
    copies,
    `<img class="art" src="${book.cover}" alt=""><div class="band"><h1 class="display">${t(book, 'thanks')}</h1></div>`,
    `<div class="back"><h2 class="display">${t(book, 'thanks')}</h2><p class="row">${t(book, 'love')}</p></div>`,
  );
}

/** Hoja de stickers redondos de 2" (50 mm), con el contorno de corte marcado. */
function stickers(book: KitBook, copies: number) {
  const paper = PAPER_MM[book.paper];
  const size = 50;
  const columns = 3;
  const rows = 4;
  const gapX = (paper.width - columns * size) / (columns + 1);
  const gapY = (paper.height - 20 - rows * size) / (rows + 1);
  const items = Array.from({ length: columns * rows }, (_, index) => {
    const left = gapX + (index % columns) * (size + gapX);
    const top = gapY + Math.floor(index / columns) * (size + gapY);
    return `<div class="sticker" style="left:${String(left)}mm;top:${String(top)}mm"><img src="${book.cover}" alt=""><p><span class="display">${escapeHtml(book.childName)}</span>${book.turningAge ? `<small>${t(book, 'years')}</small>` : ''}</p></div>`;
  }).join('');
  const css = `
.sticker { position: absolute; width: ${String(size)}mm; height: ${String(size)}mm; border-radius: 50%; overflow: hidden; border: 0.3mm dashed #b9acbf; }
.sticker img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 62%; }
.sticker p { position: absolute; left: 0; right: 0; bottom: 0; padding: 2mm 0 4mm; background: rgba(255,250,243,0.92); text-align: center; line-height: 1.1; }
.sticker p span { display: block; font-size: 12pt; }
.sticker p small { font-size: 8pt; font-weight: 700; color: ${LAVENDER}; }`;
  return {
    css,
    pages: [
      `<section class="page" data-label="stickers">${items}<p class="license">${t(book, 'license', { copies })} · ${t(book, 'cut')}</p></section>`,
    ],
  };
}

/** Etiquetas para la bolsita de souvenirs (63×89 mm), con el agujero marcado. */
function favorTags(book: KitBook, copies: number) {
  const paper = PAPER_MM[book.paper];
  const tag = { width: 63, height: 89 };
  const columns = 3;
  const rows = 3;
  const gapX = (paper.width - columns * tag.width) / (columns + 1);
  const gapY = (paper.height - 16 - rows * tag.height) / (rows + 1);
  const items = Array.from({ length: columns * rows }, (_, index) => {
    const left = gapX + (index % columns) * (tag.width + gapX);
    const top = gapY + Math.floor(index / columns) * (tag.height + gapY);
    return `<div class="tag" style="left:${String(left)}mm;top:${String(top)}mm"><span class="hole"></span><img src="${book.cover}" alt=""><p class="display">${t(book, 'tag')}</p><small>${escapeHtml(book.childName)}${book.turningAge ? ` · ${t(book, 'years')}` : ''}</small></div>`;
  }).join('');
  const css = `
.tag { position: absolute; width: ${String(tag.width)}mm; height: ${String(tag.height)}mm; border: 0.3mm dashed #b9acbf; border-radius: 4mm; overflow: hidden; background: ${PAPER}; text-align: center; }
.tag .hole { position: absolute; top: 4mm; left: 50%; width: 5mm; height: 5mm; margin-left: -2.5mm; border-radius: 50%; border: 0.3mm solid #b9acbf; background: #fff; z-index: 1; }
.tag img { display: block; width: 100%; height: 50mm; object-fit: cover; object-position: 50% 60%; }
.tag p { margin: 3mm 3mm 1mm; font-size: 12pt; }
.tag small { font-size: 8.5pt; font-weight: 700; color: ${LAVENDER}; }`;
  return {
    css,
    pages: [
      `<section class="page" data-label="etiquetas">${items}<p class="license">${t(book, 'license', { copies })} · ${t(book, 'cut')}</p></section>`,
    ],
  };
}

/** Kit de actividades del cumple (laberinto, dibujar la torta, unir palabras). Sin IA. */
function activities(book: KitBook, copies: number) {
  const words = t(book, 'words').split(' · ');
  const page = (title: string, body: string, index: number) =>
    `<section class="page" data-label="actividad ${String(index)}"><div class="activity"><p class="kicker">${t(book, 'activities')}</p><h2 class="display">${title}</h2>${body}</div><p class="license">${t(book, 'license', { copies })}</p></section>`;
  const css = `
.activity { position: absolute; inset: 16mm 16mm 18mm; display: flex; flex-direction: column; gap: 6mm; }
.activity .kicker { font-size: 9pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: ${LAVENDER}; }
.activity h2 { font-size: 24pt; }
.activity svg { width: 100%; flex: 1; }
.activity .box { flex: 1; border: 0.6mm dashed #b9acbf; border-radius: 6mm; }
.activity .hint { font-size: 12pt; color: #69616c; }
.match { display: grid; grid-template-columns: 1fr 1fr; gap: 14mm 30mm; font-size: 18pt; font-family: 'Fraunces', serif; margin-top: 10mm; }
.match .right { text-align: right; }`;
  return {
    css,
    pages: [
      page(t(book, 'maze'), mazeSvg(10, 13, book.childName.length * 31 + 7), 1),
      page(t(book, 'draw'), `<p class="hint">${t(book, 'drawHint')}</p><div class="box"></div>`, 2),
      page(
        t(book, 'match'),
        `<div class="match">${words.map((word, row) => `<span>${word}</span><span class="right">${[...words].reverse()[row] ?? ''}</span>`).join('')}</div>`,
        3,
      ),
    ],
  };
}

export interface KitPieceDocument {
  piece: Exclude<KitPiece, 'mini_book'>;
  html: string;
  size: { width: number; height: number };
  pages: number;
}

/** El HTML de cada pieza (el librito es el PDF digital del libro, que ya existe). */
export function kitPieceDocument(
  book: KitBook,
  piece: Exclude<KitPiece, 'mini_book'>,
  copies: number,
): KitPieceDocument {
  const built =
    piece === 'invitation'
      ? invitation(book, copies)
      : piece === 'thank_you'
        ? thankYou(book, copies)
        : piece === 'stickers'
          ? stickers(book, copies)
          : piece === 'favor_tags'
            ? favorTags(book, copies)
            : activities(book, copies);
  const size = PAPER_MM[book.paper];
  return {
    piece,
    html: kitDocument(size, built.css, built.pages),
    size,
    pages: built.pages.length,
  };
}
