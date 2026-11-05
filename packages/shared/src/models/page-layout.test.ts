import { describe, expect, it } from 'vitest';

import {
  bookLayout,
  calmSideFor,
  layoutSceneNote,
  pageLayout,
  pagesPerScene,
  scenesFor,
} from './page-layout';

const at = (age: number, words: number, pageIndex = 1, contentType = 'story') =>
  pageLayout({ layout: bookLayout(age, contentType), words, pageIndex, contentType });

describe('armado de página por edad', () => {
  it('hasta 6 años el texto va en la zona calma; si es largo, sobre el papel fundido', () => {
    expect(at(4, 20).kind).toBe('calm');
    expect(at(6, 45).kind).toBe('calm');
    expect(at(6, 46).kind).toBe('vignette');
  });

  it('7 y 8 años: la ilustración se funde en el papel', () => {
    expect(at(7, 20).kind).toBe('vignette');
    expect(at(8, 80).kind).toBe('vignette');
  });

  it('desde 9 años (y adultos): página de texto e ilustración enfrentadas, la mitad de escenas', () => {
    expect(at(9, 120).kind).toBe('facing');
    expect(at(40, 30).kind).toBe('facing');
    const layout = bookLayout(10, 'story');
    expect(scenesFor(30, layout)).toBe(15);
    expect(pagesPerScene(layout)).toBe(2);
    expect(scenesFor(30, bookLayout(5, 'story'))).toBe(30);
  });

  it('el lado se alterna como en el prompt y las muestras anteriores siguen con el panel', () => {
    expect(calmSideFor(1)).toBe('top');
    expect(calmSideFor(2)).toBe('bottom');
    expect(pageLayout({ layout: null, words: 30, pageIndex: 2 })).toEqual({
      kind: 'overlay',
      side: 'bottom',
    });
  });

  it('colorear conserva su armado', () => {
    expect(bookLayout(10, 'coloring').facing).toBe(false);
    expect(at(10, 10, 1, 'coloring')).toEqual({ kind: 'overlay', side: 'top' });
  });

  it('el prompt pide el espacio que el armado necesita', () => {
    expect(layoutSceneNote({ kind: 'vignette', side: 'bottom' })).toContain(
      'bottom third of the image as plain warm cream paper',
    );
    expect(layoutSceneNote({ kind: 'facing', side: 'top' })).toContain('Full-page illustration');
    expect(layoutSceneNote({ kind: 'calm', side: 'top' })).toContain('top third');
  });
});
