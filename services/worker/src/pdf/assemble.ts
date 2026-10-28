import { PDFDocument } from 'pdf-lib';

/**
 * Libro en un solo PDF (Gelato): pliego de tapa, guarda en blanco, la tripa y otra guarda en
 * blanco al final. Las guardas no se imprimen pero ocupan su lugar en el archivo.
 */
export async function assembleSinglePdf(cover: Uint8Array, interior: Uint8Array) {
  const book = await PDFDocument.create();
  const [coverDoc, interiorDoc] = await Promise.all([
    PDFDocument.load(cover),
    PDFDocument.load(interior),
  ]);
  const [coverPage] = await book.copyPages(coverDoc, [0]);
  const pages = await book.copyPages(interiorDoc, interiorDoc.getPageIndices());
  const first = pages[0];
  if (!coverPage || !first) throw new Error('Faltan la tapa o la tripa.');
  const blank = () => {
    const page = book.addPage([first.getWidth(), first.getHeight()]);
    const trim = first.getTrimBox();
    page.setTrimBox(trim.x, trim.y, trim.width, trim.height);
    const bleed = first.getBleedBox();
    page.setBleedBox(bleed.x, bleed.y, bleed.width, bleed.height);
  };
  book.addPage(coverPage);
  blank();
  for (const page of pages) book.addPage(page);
  blank();
  book.setTitle(interiorDoc.getTitle() ?? 'StoryNido');
  return book.save();
}
