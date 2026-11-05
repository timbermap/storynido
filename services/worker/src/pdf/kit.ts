import {
  invitationCopy,
  type EventType,
  type InvitationTone,
  type KitPiece,
  type PaperSize,
} from '@storynido/shared';

import { fontFaces } from './fonts';
import { mazeSvg } from './maze';
import { dotsSvg, plain, secretMessage, wordSearch, wordSearchSvg } from './puzzles';

/**
 * Piezas del kit de Eventos (fase 12b): cumpleaños y otras ocasiones. Se arman con la portada y las ilustraciones del
 * librito ya aprobado: ninguna pieza vuelve a usar IA. Se imprimen en casa o en una imprenta
 * local: tamaño real, marcas de corte y la licencia de copias en cada hoja.
 */

export type KitLang = 'es' | 'en' | 'pt';

export interface KitBook {
  language: KitLang;
  childName: string;
  title: string;
  /** Ocasión: cambia los textos de las piezas (el cumpleaños es la base). */
  occasion: EventType;
  /** Tono de la invitación de cumpleaños (por defecto, el texto de siempre). */
  tone?: InvitationTone;
  turningAge: number | null;
  /** Fecha del evento (AAAA-MM-DD). */
  eventDate: string | null;
  invitation: { time: string | null; place: string | null } | null;
  /** Portada aprobada (data URI). */
  cover: string;
  paper: PaperSize;
  /** Invitados: con nombres, las etiquetas de la bolsita salen una por invitado («Para Juana»). */
  guests?: readonly string[];
  /** Palabras del cuento para la sopa de letras (ya en mayúsculas y sin tildes). */
  storyWords?: readonly string[];
  /** Otras ilustraciones del cuento (data URI) para variar stickers y etiquetas; la portada va primero. */
  pictures?: readonly string[];
  /** Firma discreta «Hecho con StoryNido» en el dorso de la invitación (por defecto sí; se puede quitar). */
  signature?: boolean;
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
    dots: 'Une los puntos del 1 al 10',
    dotsHint: 'Empieza en el 1 y sigue en orden. ¿Qué dibujo aparece?',
    search: 'Sopa de letras del cuento',
    searchHint: 'Encuentra estas palabras. Pueden estar en {directions}.',
    searchEasy: 'derecha, abajo y en diagonal',
    searchHard: 'cualquier dirección, también al revés',
    secret: 'Mensaje secreto',
    secretHint: 'Cada número es una letra. Usa la tabla para descubrir el mensaje.',
    secretMsg: 'FELIZ CUMPLE',
    secretMsgOther: 'MUCHAS FELICITACIONES',
    solutions: 'Soluciones para los adultos',
    solSearch: 'Sopa de letras',
    solSecret: 'Mensaje secreto',
    turning: '¡{name} cumple {age}!',
    birthday: '¡Es el cumple de {name}!',
    when: 'Cuándo',
    time: 'Hora',
    where: 'Dónde',
    thanks: '¡Gracias por venir a mi cumple!',
    love: 'Con cariño, {name}',
    tag: '¡Gracias por venir!',
    tagFor: 'Para {guest}',
    madeWith: 'Hecho con StoryNido · storynido.com',
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
    dots: 'Connect the dots from 1 to 10',
    dotsHint: 'Start at 1 and follow the numbers. What picture appears?',
    search: 'Story word search',
    searchHint: 'Find these words. They can be placed {directions}.',
    searchEasy: 'across, down and diagonally',
    searchHard: 'in any direction, even backwards',
    secret: 'Secret message',
    secretHint: 'Each number is a letter. Use the key to read the message.',
    secretMsg: 'HAPPY BIRTHDAY',
    secretMsgOther: 'CONGRATULATIONS',
    solutions: 'Answers for the grown-ups',
    solSearch: 'Word search',
    solSecret: 'Secret message',
    turning: '{name} is turning {age}!',
    birthday: 'It’s {name}’s birthday!',
    when: 'When',
    time: 'Time',
    where: 'Where',
    thanks: 'Thank you for coming to my party!',
    love: 'Love, {name}',
    tag: 'Thanks for coming!',
    tagFor: 'For {guest}',
    madeWith: 'Made with StoryNido · storynido.com',
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
    dots: 'Ligue os pontos de 1 a 10',
    dotsHint: 'Comece no 1 e siga a ordem. Que desenho aparece?',
    search: 'Caça-palavras da história',
    searchHint: 'Encontre estas palavras. Elas podem estar {directions}.',
    searchEasy: 'para a direita, para baixo e na diagonal',
    searchHard: 'em qualquer direção, até de trás para frente',
    secret: 'Mensagem secreta',
    secretHint: 'Cada número é uma letra. Use a tabela para descobrir a mensagem.',
    secretMsg: 'FELIZ ANIVERSARIO',
    secretMsgOther: 'PARABENS',
    solutions: 'Respostas para os adultos',
    solSearch: 'Caça-palavras',
    solSecret: 'Mensagem secreta',
    turning: '{name} vai fazer {age}!',
    birthday: 'É o aniversário de {name}!',
    when: 'Quando',
    time: 'Hora',
    where: 'Onde',
    thanks: 'Obrigado por vir ao meu aniversário!',
    love: 'Com carinho, {name}',
    tag: 'Obrigado por vir!',
    tagFor: 'Para {guest}',
    madeWith: 'Feito com StoryNido · storynido.com',
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

/** Textos que cambian según la ocasión; lo que no está acá sale de STRINGS (cumpleaños). */
const OCCASION_STRINGS: Record<
  Exclude<EventType, 'birthday'>,
  Record<KitLang, Record<string, string>>
> = {
  baptism: {
    es: {
      birthday: '¡El bautismo de {name}!',
      thanks: '¡Gracias por acompañarme en mi bautismo!',
      tag: '¡Gracias por acompañarnos!',
      activities: 'Actividades del bautismo de {name}',
      maze: 'Ayuda a {name} a llegar a la fiesta',
      draw: 'Dibuja un recuerdo de este día',
      drawHint: '¿Quiénes estaban? ¿Qué te gustó más?',
      words: 'globo · regalo · flor · torta',
      license: 'Licencia StoryNido: {copies} copias para el bautismo de {name}.',
    },
    en: {
      birthday: '{name}’s baptism!',
      thanks: 'Thank you for joining me on my baptism day!',
      tag: 'Thanks for joining us!',
      activities: '{name}’s baptism activities',
      maze: 'Help {name} get to the party',
      draw: 'Draw a memory of this day',
      drawHint: 'Who was there? What did you like best?',
      words: 'balloon · gift · flower · cake',
      license: 'StoryNido license: {copies} copies for {name}’s baptism.',
    },
    pt: {
      birthday: 'O batizado de {name}!',
      thanks: 'Obrigado por me acompanhar no meu batizado!',
      tag: 'Obrigado por nos acompanhar!',
      activities: 'Atividades do batizado de {name}',
      maze: 'Ajude {name} a chegar à festa',
      draw: 'Desenhe uma lembrança deste dia',
      drawHint: 'Quem estava lá? Do que você mais gostou?',
      words: 'balão · presente · flor · bolo',
      license: 'Licença StoryNido: {copies} cópias para o batizado de {name}.',
    },
  },
  communion: {
    es: {
      birthday: '¡La primera comunión de {name}!',
      thanks: '¡Gracias por acompañarme en mi primera comunión!',
      tag: '¡Gracias por acompañarnos!',
      activities: 'Actividades de la comunión de {name}',
      maze: 'Ayuda a {name} a llegar a la fiesta',
      draw: 'Dibuja un recuerdo de este día',
      drawHint: '¿Quiénes estaban? ¿Qué te gustó más?',
      words: 'globo · regalo · flor · torta',
      license: 'Licencia StoryNido: {copies} copias para la primera comunión de {name}.',
    },
    en: {
      birthday: '{name}’s First Communion!',
      thanks: 'Thank you for joining me on my First Communion!',
      tag: 'Thanks for joining us!',
      activities: '{name}’s First Communion activities',
      maze: 'Help {name} get to the party',
      draw: 'Draw a memory of this day',
      drawHint: 'Who was there? What did you like best?',
      words: 'balloon · gift · flower · cake',
      license: 'StoryNido license: {copies} copies for {name}’s First Communion.',
    },
    pt: {
      birthday: 'A primeira comunhão de {name}!',
      thanks: 'Obrigado por me acompanhar na minha primeira comunhão!',
      tag: 'Obrigado por nos acompanhar!',
      activities: 'Atividades da comunhão de {name}',
      maze: 'Ajude {name} a chegar à festa',
      draw: 'Desenhe uma lembrança deste dia',
      drawHint: 'Quem estava lá? Do que você mais gostou?',
      words: 'balão · presente · flor · bolo',
      license: 'Licença StoryNido: {copies} cópias para a primeira comunhão de {name}.',
    },
  },
  graduation: {
    es: {
      birthday: '¡Felicitaciones, {name}!',
      thanks: '¡Gracias por festejar conmigo!',
      tag: '¡Gracias por este año!',
      activities: 'Actividades del egreso de {name}',
      maze: 'Ayuda a {name} a llegar a su diploma',
      draw: 'Dibuja tu mejor recuerdo del año',
      drawHint: '¿Con quién jugabas? ¿Qué aprendiste?',
      words: 'diploma · mochila · lápiz · globo',
      license: 'Licencia StoryNido: {copies} copias para el egreso de {name}.',
    },
    en: {
      birthday: 'Congratulations, {name}!',
      thanks: 'Thank you for celebrating with me!',
      tag: 'Thanks for a great year!',
      activities: '{name}’s graduation activities',
      maze: 'Help {name} get to the diploma',
      draw: 'Draw your best memory of the year',
      drawHint: 'Who did you play with? What did you learn?',
      words: 'diploma · backpack · pencil · balloon',
      license: 'StoryNido license: {copies} copies for {name}’s graduation.',
    },
    pt: {
      birthday: 'Parabéns, {name}!',
      thanks: 'Obrigado por comemorar comigo!',
      tag: 'Obrigado por este ano!',
      activities: 'Atividades da formatura de {name}',
      maze: 'Ajude {name} a chegar ao diploma',
      draw: 'Desenhe sua melhor lembrança do ano',
      drawHint: 'Com quem você brincava? O que aprendeu?',
      words: 'diploma · mochila · lápis · balão',
      license: 'Licença StoryNido: {copies} cópias para a formatura de {name}.',
    },
  },
};

const SMALL_WORDS = new Set([
  'de',
  'del',
  'la',
  'las',
  'el',
  'los',
  'y',
  'e',
  'en',
  'da',
  'do',
  'of',
  'the',
  'and',
  'at',
]);

/** «casa de pepe» → «Casa de Pepe»: mayúscula inicial en cada palabra, menos los conectores. */
export function tidyText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word, index) =>
      index > 0 && SMALL_WORDS.has(word.toLowerCase())
        ? word.toLowerCase()
        : word.charAt(0).toLocaleUpperCase() + word.slice(1),
    )
    .join(' ');
}

/** Datos que escribe la familia, ordenados antes de imprimirlos (el nombre del niño no se toca). */
function tidyBook(book: KitBook): KitBook {
  return {
    ...book,
    invitation: book.invitation
      ? {
          ...book.invitation,
          place: book.invitation.place ? tidyText(book.invitation.place) : null,
        }
      : null,
    guests: book.guests?.map(tidyText),
  };
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function t(book: KitBook, key: string, extra: Record<string, string | number> = {}) {
  const occasion = book.occasion === 'birthday' ? undefined : OCCASION_STRINGS[book.occasion];
  // Las dos frases de la invitación dependen de la ocasión y del tono (las mismas de la muestra).
  const toned =
    key === 'invite' || key === 'waiting'
      ? invitationCopy(book.language, book.occasion, book.tone)[key]
      : undefined;
  let value = toned ?? occasion?.[book.language][key] ?? STRINGS[book.language][key] ?? key;
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

/** Tarjeta lista para la imprenta: frente y dorso a sangre (127×178 mm + 3 mm por lado), sin marcas. */
export const CARD_PRINT_SIZE = { width: CARD.width + 2 * BLEED, height: CARD.height + 2 * BLEED };

function cardSheet(book: KitBook, copies: number, front: string, back: string, print = false) {
  const paper = PAPER_MM[book.paper];
  const x = (paper.width - CARD.width) / 2;
  const y = (paper.height - CARD.height) / 2;
  const sheet = (content: string) =>
    print
      ? `<section class="page" data-label="tarjeta"><div class="card" style="left:0;top:0">${content}</div></section>`
      : `<section class="page" data-label="tarjeta">
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
.card .made { position: absolute; left: 0; right: 0; bottom: 0; font-size: 7.5pt; color: #8a8090; letter-spacing: 0.04em; }
.card .line { display: block; margin: 2mm auto 0; width: 70%; border-bottom: 0.4mm solid #c9bfcf; height: 6mm; }
.marks { position: absolute; inset: 0; width: 100%; height: 100%; }
.marks line { stroke: #000; stroke-width: 0.25; }`;
  return { css, pages: [sheet(front), sheet(back)] };
}

function invitation(book: KitBook, copies: number, print = false) {
  const date = formatDate(book);
  const field = (label: string, value: string | null | undefined) =>
    `<p class="row"><b>${t(book, label)}</b>${value ? escapeHtml(value) : '<span class="line"></span>'}</p>`;
  return cardSheet(
    book,
    copies,
    `<img class="art" src="${book.cover}" alt=""><div class="band"><h1 class="display">${book.occasion === 'birthday' && book.turningAge ? t(book, 'turning') : t(book, 'birthday')}</h1><p>${t(book, 'invite')}</p></div>`,
    `<div class="back"><h2 class="display">${t(book, 'invite')}</h2>${field('when', date)}${book.invitation?.time ? field('time', book.invitation.time) : ''}${field('where', book.invitation?.place)}<p class="row">${t(book, 'waiting')}</p>${book.signature === false ? '' : `<p class="made">${t(book, 'madeWith')}</p>`}</div>`,
    print,
  );
}

function thankYou(book: KitBook, copies: number, print = false) {
  return cardSheet(
    book,
    copies,
    `<img class="art" src="${book.cover}" alt=""><div class="band"><h1 class="display">${t(book, 'thanks')}</h1></div>`,
    `<div class="back"><h2 class="display">${t(book, 'thanks')}</h2><p class="row">${t(book, 'love')}</p></div>`,
    print,
  );
}

/** Hoja de stickers redondos de 2" (50 mm), con el contorno de corte marcado. */
/** Ilustración de la pieza número `index`: la portada y las demás del cuento, en rotación. */
function artAt(book: KitBook, index: number): string {
  const all = [book.cover, ...(book.pictures ?? [])];
  return all[index % all.length] ?? book.cover;
}

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
    return `<div class="sticker" style="left:${String(left)}mm;top:${String(top)}mm"><img src="${artAt(book, index)}" alt=""><p><span class="display">${escapeHtml(book.childName)}</span>${book.turningAge ? `<small>${t(book, 'years')}</small>` : ''}</p></div>`;
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
  const perSheet = columns * rows;
  const gapX = (paper.width - columns * tag.width) / (columns + 1);
  const gapY = (paper.height - 16 - rows * tag.height) / (rows + 1);
  // Con lista de invitados: una etiqueta por invitado, con su nombre; sin lista, la genérica.
  const guests = book.guests ?? [];
  const labels: (string | null)[] =
    guests.length > 0 ? [...guests] : Array<null>(perSheet).fill(null);
  const sheets = Array.from({ length: Math.ceil(labels.length / perSheet) }, (_, sheet) =>
    labels.slice(sheet * perSheet, (sheet + 1) * perSheet),
  );
  const pages = sheets.map((sheet) => {
    const items = sheet
      .map((guest, index) => {
        const left = gapX + (index % columns) * (tag.width + gapX);
        const top = gapY + Math.floor(index / columns) * (tag.height + gapY);
        const heading = guest === null ? t(book, 'tag') : t(book, 'tagFor', { guest });
        return `<div class="tag" style="left:${String(left)}mm;top:${String(top)}mm"><span class="hole"></span><img src="${artAt(book, index + 1)}" alt=""><p class="display">${heading}</p><small>${escapeHtml(book.childName)}${book.turningAge ? ` · ${t(book, 'years')}` : ''}</small></div>`;
      })
      .join('');
    return `<section class="page" data-label="etiquetas">${items}<p class="license">${t(book, 'license', { copies })} · ${t(book, 'cut')}</p></section>`;
  });
  const css = `
.tag { position: absolute; width: ${String(tag.width)}mm; height: ${String(tag.height)}mm; border: 0.3mm dashed #b9acbf; border-radius: 4mm; overflow: hidden; background: ${PAPER}; text-align: center; }
.tag .hole { position: absolute; top: 4mm; left: 50%; width: 5mm; height: 5mm; margin-left: -2.5mm; border-radius: 50%; border: 0.3mm solid #b9acbf; background: #fff; z-index: 1; }
.tag img { display: block; width: 100%; height: 50mm; object-fit: cover; object-position: 50% 60%; }
.tag p { margin: 3mm 3mm 1mm; font-size: 12pt; }
.tag small { font-size: 8.5pt; font-weight: 700; color: ${LAVENDER}; }`;
  return { css, pages };
}

/** Nivel de las actividades según la edad que cumple (sin edad, el del medio: 6 a 8 años). */
export type ActivityLevel = 'little' | 'middle' | 'big';

export const activityLevel = (age: number | null): ActivityLevel =>
  age !== null && age <= 5 ? 'little' : age !== null && age >= 9 ? 'big' : 'middle';

/** Pasatiempos del cumple (sin IA): el nivel sigue la edad y la sopa de letras usa palabras del cuento. */
function activities(book: KitBook, copies: number) {
  const level = activityLevel(book.turningAge);
  const seed = book.childName.length * 31 + 7;
  const page = (title: string, body: string, index: number) =>
    `<section class="page" data-label="actividad ${String(index)}"><div class="activity"><p class="kicker">${t(book, 'activities')}</p><h2 class="display">${title}</h2>${body}</div><p class="license">${t(book, 'license', { copies })}</p></section>`;
  const css = `
.activity { position: absolute; inset: 16mm 16mm 18mm; display: flex; flex-direction: column; gap: 6mm; }
.activity .kicker { font-size: 9pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: ${LAVENDER}; }
.activity h2 { font-size: 24pt; }
.activity svg { width: 100%; flex: 1; min-height: 0; }
.activity .box { flex: 1; border: 0.6mm dashed #b9acbf; border-radius: 6mm; }
.activity .hint { font-size: 12pt; color: #69616c; }
.activity .words { display: flex; flex-wrap: wrap; gap: 3mm 8mm; font-size: 13pt; font-weight: 700; color: ${INK}; letter-spacing: 0.08em; }
.activity .key { display: flex; flex-wrap: wrap; gap: 2mm; }
.activity .key span { display: flex; flex-direction: column; align-items: center; width: 10mm; border: 0.3mm solid #b9acbf; border-radius: 2mm; font-size: 11pt; font-weight: 700; }
.activity .key span small { font-size: 9pt; color: ${LAVENDER}; border-top: 0.3mm solid #b9acbf; width: 100%; text-align: center; }
.activity .cipher { display: flex; flex-wrap: wrap; gap: 6mm 9mm; }
.activity .cipher .word { display: flex; gap: 2mm; }
.activity .cipher .letter { display: flex; flex-direction: column; align-items: center; width: 10mm; font-size: 13pt; font-weight: 700; }
.activity .cipher .letter i { display: block; width: 100%; height: 9mm; border-bottom: 0.4mm solid ${INK}; }
.activity .solved { font-size: 14pt; font-weight: 700; letter-spacing: 0.1em; color: ${INK}; }`;
  const maze =
    level === 'little'
      ? mazeSvg(8, 10, seed)
      : level === 'middle'
        ? mazeSvg(15, 19, seed)
        : mazeSvg(20, 26, seed);
  const pages: string[] = [page(t(book, 'maze'), maze, 1)];
  if (level === 'little') {
    pages.push(
      page(t(book, 'dots'), `<p class="hint">${t(book, 'dotsHint')}</p>${dotsSvg()}`, 2),
      page(t(book, 'draw'), `<p class="hint">${t(book, 'drawHint')}</p><div class="box"></div>`, 3),
    );
    return { css, pages };
  }
  const hard = level === 'big';
  const words = storyWordsOf(book, hard ? 8 : 6, hard ? 14 : 11);
  const puzzle = wordSearch(words, hard ? 15 : 12, seed + 3, hard);
  const searchBody = `<p class="hint">${t(book, 'searchHint', { directions: t(book, hard ? 'searchHard' : 'searchEasy') })}</p><div class="words">${puzzle.words.map(escapeHtml).join('<span>·</span>')}</div>${wordSearchSvg(puzzle, false)}`;
  pages.push(page(t(book, 'search'), searchBody, 2));
  const message = `${t(book, book.occasion === 'birthday' ? 'secretMsg' : 'secretMsgOther')} ${book.childName}`;
  const secret = secretMessage(message, seed + 11);
  const cipher = `<div class="cipher">${secret.words
    .map(
      (word) =>
        `<div class="word">${word.map((number) => `<span class="letter">${String(number)}<i></i></span>`).join('')}</div>`,
    )
    .join('')}</div>`;
  const keyTable = `<div class="key">${secret.key.map((entry) => `<span>${entry.letter}<small>${String(entry.number)}</small></span>`).join('')}</div>`;
  pages.push(
    page(t(book, 'secret'), `<p class="hint">${t(book, 'secretHint')}</p>${keyTable}${cipher}`, 3),
    page(t(book, 'draw'), `<p class="hint">${t(book, 'drawHint')}</p><div class="box"></div>`, 4),
    page(
      t(book, 'solutions'),
      `<p class="hint">${t(book, 'solSearch')}</p>${wordSearchSvg(puzzle, true)}<p class="hint">${t(book, 'solSecret')}</p><p class="solved">${escapeHtml(plain(message).length > 0 ? message.replace(/[^\p{L} ]/gu, '') : message)}</p>`,
      5,
    ),
  );
  return { css, pages };
}

/** Palabras de la sopa de letras: las del cuento y, si faltan, las del cumpleaños. */
function storyWordsOf(book: KitBook, count: number, max: number): string[] {
  const own = [...(book.storyWords ?? [])].filter((word) => word.length <= max);
  const fallback = t(book, 'words')
    .split(' · ')
    .map(plain)
    .filter((word) => word.length >= 4 && word.length <= max);
  return [...new Set([...own, ...fallback])].slice(0, count);
}

/** La invitación como imagen para WhatsApp (4:5, 1080×1350 px). */
export const INVITATION_IMAGE_SIZE = { width: 1080, height: 1350 } as const;

export function invitationImageHtml(raw: KitBook): string {
  const book = tidyBook(raw);
  const date = formatDate(book);
  const heading =
    book.occasion === 'birthday' && book.turningAge ? t(book, 'turning') : t(book, 'birthday');
  const details = [
    date ? `<p><b>${t(book, 'when')}</b> ${escapeHtml(date)}</p>` : '',
    book.invitation?.time
      ? `<p><b>${t(book, 'time')}</b> ${escapeHtml(book.invitation.time)}</p>`
      : '',
    book.invitation?.place
      ? `<p><b>${t(book, 'where')}</b> ${escapeHtml(book.invitation.place)}</p>`
      : '',
  ].join('');
  const signature = book.signature === false ? '' : `<p class="made">${t(book, 'madeWith')}</p>`;
  const { width, height } = INVITATION_IMAGE_SIZE;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces()}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${String(width)}px; height: ${String(height)}px; }
body { font-family: 'Nunito Sans', sans-serif; color: ${INK}; background: ${PAPER}; display: flex; flex-direction: column; }
.art { width: 100%; height: 820px; object-fit: cover; object-position: 50% 75%; display: block; }
.text { flex: 1; padding: 44px 64px 34px; text-align: center; display: flex; flex-direction: column; justify-content: center; gap: 14px; }
h1 { font-size: 76px; line-height: 1.05; color: ${INK}; }
.invite { font-size: 36px; font-weight: 700; color: ${LAVENDER}; }
.details p { font-size: 32px; line-height: 1.35; }
.details b { font-size: 22px; letter-spacing: 0.12em; text-transform: uppercase; color: #8a8090; margin-right: 8px; }
.made { font-size: 22px; color: #8a8090; letter-spacing: 0.04em; }
</style></head><body><img class="art" src="${book.cover}" alt=""><div class="text"><h1 class="display">${heading}</h1><p class="invite">${t(book, 'invite')}</p><div class="details">${details}</div>${signature}</div><script>document.fonts.ready.then(() => { window.__fitted = true; });</script></body></html>`;
}

export interface KitPieceDocument {
  piece: Exclude<KitPiece, 'mini_book'>;
  html: string;
  size: { width: number; height: number };
  pages: number;
}

/** El HTML de cada pieza (el librito es el PDF digital del libro, que ya existe). */
export function kitPieceDocument(
  raw: KitBook,
  piece: Exclude<KitPiece, 'mini_book'>,
  copies: number,
): KitPieceDocument {
  const book = tidyBook(raw);
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

/** Tarjeta para imprimir (invitación o agradecimiento): un PDF de dos páginas, frente y dorso. */
export function kitCardPrintDocument(
  raw: KitBook,
  piece: 'invitation' | 'thank_you',
): KitPieceDocument {
  const book = tidyBook(raw);
  const built = piece === 'invitation' ? invitation(book, 0, true) : thankYou(book, 0, true);
  return {
    piece,
    html: kitDocument(CARD_PRINT_SIZE, built.css, built.pages),
    size: CARD_PRINT_SIZE,
    pages: built.pages.length,
  };
}
