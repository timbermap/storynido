import { describe, expect, it } from 'vitest';

import {
  READING_FORMATS,
  readingFormatsFor,
  suggestedReading,
  withEventWordCap,
} from './editorial';

describe('formatos de lectura por edad', () => {
  it('cada edad de 0 en adelante tiene formatos y uno solo recomendado primero', () => {
    for (const age of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15]) {
      const formats = readingFormatsFor(age);
      expect(formats.length).toBeGreaterThan(0);
      expect(formats.length).toBeLessThanOrEqual(3);
      expect(formats[0]?.recommended).toBe(true);
      expect(formats.filter((format) => format.recommended)).toHaveLength(1);
    }
    expect(readingFormatsFor(null)).toEqual([]);
  });

  it('los bebés no ven libros largos ni los de 9 a 12 libros de bebé', () => {
    expect(readingFormatsFor(1).map((format) => format.length)).toEqual(['short']);
    expect(readingFormatsFor(10).map((format) => format.key)).toEqual([
      'long_illustrated',
      'short_story',
      'illustrated_story',
    ]);
  });

  it('lo sugerido es el formato recomendado de la edad', () => {
    expect(suggestedReading(1)).toEqual({
      length: 'short',
      textDensity: 'visual',
      readingLevel: 'beginner',
    });
    expect(suggestedReading(7).length).toBe('epic');
    expect(suggestedReading(11).textDensity).toBe('rich');
    expect(READING_FORMATS.length).toBeGreaterThan(0);
  });
});

describe('tope de palabras del mini cuento', () => {
  it('eventos: no más de 60 palabras por página y un rango válido', () => {
    const rich = { words: { min: 70, max: 120 } };
    expect(withEventWordCap(rich, true).words).toEqual({ min: 36, max: 60 });
    expect(withEventWordCap({ words: { min: 5, max: 20 } }, true).words).toEqual({
      min: 5,
      max: 20,
    });
    expect(withEventWordCap(rich, false)).toBe(rich);
  });
});
