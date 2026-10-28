import type { ActivitySpec, PrintFileSpec } from '@storynido/shared';

import { fontFaces } from './fonts';
import { mazeSvg } from './maze';
import type { TextPlacement } from './placement';
import { pageSizeMm, spineMm, trimOf, type FormatSpec } from './spec';

export type Density = 'visual' | 'balanced' | 'rich';
export type Lang = 'es' | 'en' | 'pt';

export interface LayoutBook {
  language: Lang;
  title: string;
  childName: string;
  /** Dedicatoria aprobada tal cual (null: se usa la frase por defecto). */
  dedication: string | null;
  contentType: string;
  density: Density;
  readingLevel: 'beginner' | 'developing' | 'advanced';
  /** Portada: data URI de la ilustración. */
  cover: string;
  /** `placement`: dónde va el texto (la región más calma de la ilustración). */
  pages: { text: string; image: string; placement?: TextPlacement }[];
  activities: ActivitySpec[];
  /** Contratapa: sinopsis breve y un QR (SVG) a StoryNido. */
  synopsis?: string | null;
  /** Profesionales: aviso de que es material educativo (no una intervención clínica). */
  educationalNotice?: boolean;
  qr?: { svg: string; label: string } | null;
}

/** Colores de texto y panel: el contraste se verifica en los tests (≥ 4,5:1 en el peor caso). */
export const INK = '#342a40';
export const PAPER = '#fffaf3';
export const PANEL_ALPHA = 0.94;

/** Composición por densidad: alto máximo del panel de texto y tamaños de letra (pt). */
export const DENSITY_LAYOUT: Record<Density, { panelPct: number; fontPt: number; minPt: number }> =
  {
    visual: { panelPct: 24, fontPt: 21, minPt: 15 },
    balanced: { panelPct: 34, fontPt: 15.5, minPt: 11.5 },
    rich: { panelPct: 46, fontPt: 13, minPt: 10 },
  };

/** El nivel de lectura ajusta el tamaño: letra más grande para quienes empiezan a leer. */
const LEVEL_SCALE = { beginner: 1.12, developing: 1, advanced: 0.95 } as const;

const STRINGS: Record<Lang, Record<string, string>> = {
  es: {
    dedicationFor: 'Este cuento es para {name}.',
    end: 'Fin',
    madeFor: 'Un cuento de StoryNido creado para {name}',
    notice:
      'Material educativo creado con StoryNido. No reemplaza ni constituye una intervención profesional o clínica.',
    storyFor: 'Un cuento para {name}',
    activity: 'Actividad',
    back: 'Historias que abrazan.',
    words: 'Palabras',
  },
  en: {
    dedicationFor: 'This story is for {name}.',
    end: 'The End',
    madeFor: 'A StoryNido story made for {name}',
    notice:
      'Educational material made with StoryNido. It does not replace or constitute a professional or clinical intervention.',
    storyFor: 'A story for {name}',
    activity: 'Activity',
    back: 'Stories that hug.',
    words: 'Words',
  },
  pt: {
    dedicationFor: 'Esta história é para {name}.',
    end: 'Fim',
    madeFor: 'Uma história StoryNido criada para {name}',
    notice:
      'Material educativo criado com o StoryNido. Não substitui nem constitui uma intervenção profissional ou clínica.',
    storyFor: 'Uma história para {name}',
    activity: 'Atividade',
    back: 'Histórias que abraçam.',
    words: 'Palavras',
  },
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${String(char.charCodeAt(0))};`);
}

function text(book: LayoutBook, key: string): string {
  return (STRINGS[book.language][key] ?? key).replace('{name}', book.childName);
}

const paragraphs = (value: string) =>
  value
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');

function baseCss(spec: FormatSpec, size: { width: number; height: number }): string {
  const inset = spec.bleedMm + spec.safeMm;
  return `${fontFaces()}
@page { size: ${String(size.width)}mm ${String(size.height)}mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: ${PAPER}; }
body { font-family: 'Nunito Sans', sans-serif; color: ${INK}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: ${String(size.width)}mm; height: ${String(size.height)}mm; position: relative; overflow: hidden; break-after: page; background: ${PAPER}; }
.page:last-child { break-after: auto; }
.art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.panel { position: absolute; background: rgba(255,250,243,${String(PANEL_ALPHA)}); border-radius: 6mm; padding: 6mm 8mm; }
.panel.bottom { left: ${String(inset)}mm; right: ${String(inset)}mm; bottom: ${String(inset)}mm; }
.panel.top { left: ${String(inset)}mm; right: ${String(inset)}mm; top: ${String(inset)}mm; }
.panel.top-left { left: ${String(inset)}mm; top: ${String(inset)}mm; width: 60%; }
.panel.top-right { right: ${String(inset)}mm; top: ${String(inset)}mm; width: 60%; }
.panel.bottom-left { left: ${String(inset)}mm; bottom: ${String(inset)}mm; width: 60%; }
.panel.bottom-right { right: ${String(inset)}mm; bottom: ${String(inset)}mm; width: 60%; }
.cover-name { font-family: 'Fraunces', serif; font-weight: 600; font-size: 50pt; line-height: 1; color: #79518c; margin-top: 3mm; letter-spacing: -0.02em; }
.back { position: absolute; inset: ${String(inset)}mm; display: flex; flex-direction: column; gap: 6mm; }
.back .synopsis { font-family: 'Fraunces', serif; font-size: 15pt; line-height: 1.5; max-width: 140mm; }
.back .qr { display: flex; align-items: center; gap: 4mm; font-size: 9.5pt; color: #69616c; }
.back .qr svg { width: 22mm; height: 22mm; }
.barcode-zone { position: absolute; right: ${String(inset)}mm; bottom: ${String(inset)}mm; width: 50mm; height: 30mm; background: #fff; }
.story { font-family: 'Fraunces', serif; font-weight: 500; line-height: 1.42; color: ${INK}; }
.story p + p { margin-top: 0.6em; }
.center { position: absolute; inset: ${String(inset)}mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.title-band { position: absolute; left: 0; right: 0; top: 0; padding: ${String(inset)}mm ${String(inset)}mm 22mm; background: linear-gradient(to bottom, rgba(255,250,243,0.96) 55%, rgba(255,250,243,0)); text-align: center; }
.title { font-family: 'Fraunces', serif; font-weight: 600; font-size: 40pt; line-height: 1.05; letter-spacing: -0.025em; }
.coloring .art { object-fit: contain; background: #fff; }
.activity { position: absolute; inset: ${String(inset)}mm; display: flex; flex-direction: column; gap: 6mm; }
.activity .kicker { font-size: 10pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #79518c; }
.activity h2 { font-family: 'Fraunces', serif; font-weight: 600; font-size: 24pt; line-height: 1.1; }
.activity .instructions { font-size: 13pt; line-height: 1.45; }
.activity .box { flex: 1; border: 0.6mm dashed #b9a7c4; border-radius: 6mm; }
.activity svg { flex: 1; width: 100%; }
.match { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 10mm 30mm; align-content: center; font-size: 15pt; }
.match span { display: flex; align-items: center; gap: 4mm; }
.match span::after, .match span.right::before { content: ''; width: 3.5mm; height: 3.5mm; border-radius: 50%; background: ${INK}; }
.match span.right { justify-content: flex-start; }
.match span.right::after { display: none; }
.lines { flex: 1; display: flex; flex-direction: column; justify-content: space-evenly; }
.lines div { border-bottom: 0.4mm solid #b9a7c4; height: 14mm; }
.bank { font-size: 13pt; color: #69616c; }`;
}

/**
 * Achica la letra de cada panel hasta que entra en su alto máximo; si ni con el mínimo entra,
 * marca la página (`data-overflow`) y el render falla: el texto nunca desborda en silencio.
 */
const FIT_SCRIPT = `<script>
document.fonts.ready.then(() => {
  const mmToPx = 96 / 25.4;
  for (const panel of document.querySelectorAll('.panel[data-max-mm]')) {
    const max = Number(panel.dataset.maxMm) * mmToPx;
    const min = Number(panel.dataset.minPt);
    const story = panel.querySelector('.story');
    let size = Number(panel.dataset.fontPt);
    story.style.fontSize = size + 'pt';
    while (panel.getBoundingClientRect().height > max && size > min) {
      size = Math.round((size - 0.25) * 100) / 100;
      story.style.fontSize = size + 'pt';
    }
    if (panel.getBoundingClientRect().height > max) panel.closest('.page').dataset.overflow = 'true';
    panel.closest('.page').dataset.fontPt = String(size);
  }
  window.__fitted = true;
});
</script>`;

function storyPage(
  book: LayoutBook,
  spec: FormatSpec,
  page: LayoutBook['pages'][number],
  number: number,
) {
  const coloring = book.contentType === 'coloring';
  const layout = DENSITY_LAYOUT[coloring ? 'visual' : book.density];
  const scale = LEVEL_SCALE[book.readingLevel];
  const height = pageSizeMm(spec).height;
  const placement = coloring ? 'top' : (page.placement ?? 'bottom');
  // En una esquina el panel es más angosto: puede crecer más en alto.
  const pct = placement.includes('-') ? Math.min(layout.panelPct * 1.6, 55) : layout.panelPct;
  const maxMm = ((trimOf(spec).height * pct) / 100).toFixed(1);
  return `<section class="page${coloring ? ' coloring' : ''}" data-label="página ${String(number)}" style="height:${String(height)}mm">
  <img class="art" src="${page.image}" alt="">
  <div class="panel ${placement}" data-max-mm="${maxMm}" data-font-pt="${(layout.fontPt * scale).toFixed(2)}" data-min-pt="${(layout.minPt * scale).toFixed(2)}">
    <div class="story">${paragraphs(page.text)}</div>
  </div>
</section>`;
}

function activityPage(book: LayoutBook, activity: ActivitySpec, index: number): string {
  const items = activity.items.slice(0, 6).map(escapeHtml);
  let body: string;
  switch (activity.kind) {
    case 'maze': {
      const [columns, rows]: [number, number] =
        book.readingLevel === 'beginner'
          ? [7, 9]
          : book.readingLevel === 'developing'
            ? [10, 13]
            : [13, 17];
      body = mazeSvg(columns, rows, index * 7919 + book.childName.length);
      break;
    }
    case 'match': {
      const right = [...items].reverse();
      body = `<div class="match">${items
        .map((item, row) => `<span>${item}</span><span class="right">${right[row] ?? ''}</span>`)
        .join('')}</div>`;
      break;
    }
    case 'complete_sentence':
      body = `<p class="bank">${text(book, 'words')}: ${items.join(' · ')}</p><div class="lines">${'<div></div>'.repeat(5)}</div>`;
      break;
    default:
      // Dibujar el final (y, por ahora, "encontrar diferencias"): un recuadro para dibujar.
      body = '<div class="box"></div>';
  }
  return `<section class="page" data-label="actividad ${String(index + 1)}">
  <div class="activity">
    <p class="kicker">${text(book, 'activity')} ${String(index + 1)}</p>
    <h2>${escapeHtml(activity.title)}</h2>
    <p class="instructions">${escapeHtml(activity.instructions)}</p>
    ${body}
  </div>
</section>`;
}

/** Tapa: el título siempre con el nombre del protagonista, bien grande (una tapa vendible). */
function coverFront(book: LayoutBook, spec: FormatSpec): string {
  const hasName = book.title.toLocaleLowerCase().includes(book.childName.toLocaleLowerCase());
  const name = hasName ? '' : `<p class="cover-name">${escapeHtml(book.childName)}</p>`;
  return `<img class="art" src="${book.cover}" alt="">
  <div class="title-band" style="padding-top:${String(spec.bleedMm + spec.safeMm)}mm"><h1 class="title">${escapeHtml(book.title)}</h1>${name}</div>`;
}

/**
 * Contratapa: sinopsis, para quién es, QR a StoryNido y, en imprenta, la zona libre (blanca)
 * donde la imprenta pone el código de barras.
 */
function backCover(book: LayoutBook, print: boolean): string {
  const synopsis = book.synopsis ? `<p class="synopsis">${escapeHtml(book.synopsis)}</p>` : '';
  const qr = book.qr
    ? `<div class="qr">${book.qr.svg}<span>${escapeHtml(book.qr.label)}</span></div>`
    : '';
  return `<div class="back">
    <p style="font-family:'Fraunces',serif;font-weight:600;font-size:22pt">${escapeHtml(book.title)}</p>
    ${synopsis}
    <p style="font-family:'Fraunces',serif;font-style:italic;font-size:14pt;color:#79518c">${escapeHtml(text(book, 'storyFor'))}</p>
    <div style="margin-top:auto;display:flex;flex-direction:column;gap:5mm">
      ${qr}
      <p style="font-family:'Fraunces',serif;font-weight:600;font-size:16pt">StoryNido <span style="font-family:'Nunito Sans',sans-serif;font-weight:400;font-size:10pt;color:#69616c">· ${escapeHtml(text(book, 'back'))}</span></p>
    </div>
  </div>${print ? '<div class="barcode-zone" data-zone="barcode"></div>' : ''}`;
}

/** Interior del libro: dedicatoria, páginas, actividades y fin (sin tapas). */
export function interiorPages(book: LayoutBook, spec: FormatSpec): string[] {
  const dedication = book.dedication ?? text(book, 'dedicationFor');
  return [
    `<section class="page" data-label="dedicatoria"><div class="center"><p style="font-family:'Fraunces',serif;font-style:italic;font-size:20pt;line-height:1.5;max-width:130mm">${escapeHtml(dedication)}</p></div></section>`,
    ...book.pages.map((page, index) => storyPage(book, spec, page, index + 1)),
    ...book.activities.map((activity, index) => activityPage(book, activity, index)),
    `<section class="page" data-label="fin"><div class="center" style="gap:6mm"><p style="font-family:'Fraunces',serif;font-weight:600;font-size:40pt">${escapeHtml(text(book, 'end'))}</p><p style="font-size:11pt;color:#69616c">${escapeHtml(text(book, 'madeFor'))}</p>${book.educationalNotice ? `<p class="notice" style="margin-top:10mm;max-width:130mm;font-size:9pt;line-height:1.4;color:#69616c">${escapeHtml(text(book, 'notice'))}</p>` : ''}</div></section>`,
  ];
}

function document(
  spec: FormatSpec,
  size: { width: number; height: number },
  pages: string[],
): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss(spec, size)}</style></head><body>${pages.join('\n')}${FIT_SCRIPT}</body></html>`;
}

/** Digital: portada, interior y contratapa en un solo PDF de pantalla. */
export function digitalHtml(book: LayoutBook, spec: FormatSpec): string {
  return document(spec, pageSizeMm(spec), [
    `<section class="page" data-label="portada">${coverFront(book, spec)}</section>`,
    ...interiorPages(book, spec),
    `<section class="page" data-label="contratapa">${backCover(book, false)}</section>`,
  ]);
}

/** Imprenta: el interior en un PDF y las tapas en otro (contratapa + lomo + portada). */
export function printInteriorHtml(book: LayoutBook, spec: FormatSpec): string {
  return document(spec, pageSizeMm(spec), interiorPages(book, spec));
}

/** Pliego de tapa: la geometría la da la imprenta (lomo y vuelta según páginas y papel). */
export type CoverGeometry = PrintFileSpec['cover'];

/** Pliego genérico (imprentas sin especificación propia): sangrado común y lomo aproximado. */
export function defaultCoverGeometry(spec: FormatSpec, interiorCount: number): CoverGeometry {
  const spine = spineMm(interiorCount, spec.format);
  return {
    widthMm: 2 * trimOf(spec).width + spine + 2 * spec.bleedMm,
    heightMm: trimOf(spec).height + 2 * spec.bleedMm,
    spineLeftMm: trimOf(spec).width + spec.bleedMm,
    spineWidthMm: spine,
    edgeMm: spec.bleedMm,
  };
}

export function printCoverHtml(
  book: LayoutBook,
  spec: FormatSpec,
  cover: CoverGeometry,
  // Zona blanca para el código de barras (Gelato no la usa: lo imprime en la última página).
  barcodeZone = true,
): string {
  const { widthMm: width, heightMm: height, spineLeftMm: left, spineWidthMm: spine } = cover;
  // Los márgenes del texto se miden desde el corte: en tapa dura, la vuelta es más ancha.
  const coverSpec: FormatSpec = { ...spec, bleedMm: cover.edgeMm };
  return document(coverSpec, { width, height }, [
    `<section class="page" data-label="tapas" style="width:${String(width)}mm;height:${String(height)}mm">
  <div style="position:absolute;left:0;top:0;bottom:0;width:${String(left)}mm">${backCover(book, barcodeZone)}</div>
  <div style="position:absolute;left:${String(left)}mm;top:0;bottom:0;width:${String(spine)}mm;background:#79518c;display:flex;align-items:center;justify-content:center">
    <p style="transform:rotate(90deg);white-space:nowrap;color:#fff;font-family:'Fraunces',serif;font-size:${String(Math.min(10, spine * 1.6))}pt">${escapeHtml(book.title)}</p>
  </div>
  <div style="position:absolute;left:${String(left + spine)}mm;top:0;bottom:0;right:0;overflow:hidden">${coverFront(book, coverSpec)}</div>
</section>`,
  ]);
}
